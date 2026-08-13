"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Alert, Select, Stack, TextInput, Textarea } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import { ApiError } from "@/lib/api/api-error";
import {
  LIMIT_ENFORCEMENT_CODES,
  LimitEnforcementState,
  limitEnforcementCode,
} from "@/features/organization";
import { patientsListQueryOptions } from "@/features/patients";
import { clinicUsersQueryOptions } from "@/features/user-clinics";
import { createAppointment, updateAppointment } from "../api";
import { appointmentsQueryKeys } from "../queries";
import { appointmentFormSchema, EMPTY_APPOINTMENT_FORM_VALUES, type AppointmentFormValues } from "../schemas";
import { APPOINTMENT_TYPE_OPTIONS } from "../status";
import { isResyncError, resyncOnConflict } from "../resync";

/**
 * A bounded picker, not a browsable collection. 100 is the hard ceiling the
 * shared pagination validator enforces (`Limit cannot exceed 100.`) -- asking
 * for more is a 400, which surfaces as a silently empty picker rather than an
 * error the user can act on.
 */
const PICKER_LIMIT = 100;

/**
 * Schedule or reschedule an appointment (`UX.md` Flow 5).
 *
 * **Clinic is chosen before physiotherapist, by design.** The picker reads
 * `GET /api/clinics/{id}/users`, not `GET /api/users` -- the latter is
 * `canManageUsers` (Owner/Admin only), so Reception, this flow's primary
 * actor, could not populate it. The clinic-scoped path is also the correct
 * shape rather than a workaround: the booking rule the server enforces *is*
 * "physiotherapist assigned to this clinic", so the ordering mirrors it.
 *
 * Two failure treatments, both pre-assigned by `UX.md` and neither of them a
 * change to `ERROR_BEHAVIORS`:
 *  - `SUBSCRIPTION_REQUIRED` renders `LimitEnforcementState` inline, because a
 *    form dialog stays open long enough to host a persistent role-aware
 *    message and the user's input is preserved (ADR-0012).
 *  - `PHYSIOTHERAPIST_UNAVAILABLE` takes blocking message + resync: the
 *    physiotherapist's availability moved under the user, so the message
 *    explains it in context and the list refetches.
 */
export interface AppointmentFormDialogProps {
  opened: boolean;
  onClose: () => void;
  /** Present when rescheduling; only time, type and notes may change then. */
  appointmentId?: string;
  defaultValues?: AppointmentFormValues;
  /** Fixes the patient, for the Patient Workspace tab. */
  lockedPatientId?: string;
  extraInvalidateKeys?: readonly unknown[][];
}

export function AppointmentFormDialog({
  opened,
  onClose,
  appointmentId,
  defaultValues,
  lockedPatientId,
  extraInvalidateKeys = [],
}: AppointmentFormDialogProps) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const isEdit = Boolean(appointmentId);
  const [enforcement, setEnforcement] = useState<ReturnType<typeof limitEnforcementCode>>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: defaultValues ?? {
      ...EMPTY_APPOINTMENT_FORM_VALUES,
      patientId: lockedPatientId ?? "",
    },
  });

  // `useWatch` rather than `form.watch`: the latter returns a function the
  // React Compiler cannot memoize, and it is the only reason this component
  // would opt out of compilation.
  const clinicId = useWatch({ control: form.control, name: "clinicId" });

  const patients = useQuery({
    ...patientsListQueryOptions({ page: 1, limit: PICKER_LIMIT }),
    enabled: opened && !lockedPatientId,
  });

  // Disabled until a clinic is chosen: there is no organization-wide
  // physiotherapist list this flow's primary actor is allowed to read.
  const clinicUsers = useQuery({
    ...clinicUsersQueryOptions(clinicId),
    enabled: opened && Boolean(clinicId),
  });

  const invalidateKeys: readonly unknown[][] = [
    [...appointmentsQueryKeys.all],
    ...extraInvalidateKeys,
  ];

  const save = useMutation({
    mutationFn: (values: AppointmentFormValues) =>
      appointmentId
        ? updateAppointment(appointmentId, {
            appointmentTime: new Date(values.appointmentTime).toISOString(),
            appointmentType: values.appointmentType,
            notes: values.notes,
          })
        : createAppointment({
            patientId: values.patientId,
            clinicId: values.clinicId,
            physiotherapistId: values.physiotherapistId,
            appointmentTime: new Date(values.appointmentTime).toISOString(),
            appointmentType: values.appointmentType,
            notes: values.notes,
          }),
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      for (const queryKey of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
      notifications.show({
        color: "success",
        message: isEdit ? "Appointment rescheduled." : "Appointment scheduled.",
      });
      onClose();
    },
    onError: (error) => {
      setEnforcement(limitEnforcementCode(error));
      if (isResyncError(error)) {
        setConflictMessage(
          error instanceof ApiError && error.code === "PHYSIOTHERAPIST_UNAVAILABLE"
            ? "That physiotherapist isn't available then — they've been marked away for that time. Pick another time or physiotherapist."
            : "This appointment has changed since you opened it. The list has been refreshed."
        );
        resyncOnConflict(queryClient, error, invalidateKeys);
        return;
      }
      setConflictMessage(null);
      applyFieldErrors(error, form.setError);
    },
  });

  const physiotherapistOptions = (clinicUsers.data ?? [])
    .filter((user) => user.role?.name === "ORG_PHYSIOTHERAPIST")
    .map((user) => ({ value: user.id, label: user.full_name }));

  const patientOptions = (patients.data?.items ?? []).map((patient) => ({
    value: patient.id,
    label: `${patient.full_name} · ${patient.patient_code}`,
  }));

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Reschedule appointment" : "Schedule appointment"}
      submitLabel={isEdit ? "Save changes" : "Schedule"}
      isDirty={form.formState.isDirty}
      isSubmitting={save.isPending}
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
    >
      <Stack gap="sm">
        {enforcement && <LimitEnforcementState code={enforcement} />}
        {conflictMessage && (
          <Alert color="orange" role="alert">
            {conflictMessage}
          </Alert>
        )}

        {!isEdit && !lockedPatientId && (
          <Controller
            control={form.control}
            name="patientId"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                label="Patient"
                placeholder="Choose a patient"
                data={patientOptions}
                error={fieldState.error?.message}
              />
            )}
          />
        )}

        {!isEdit && (
          <>
            <Controller
              control={form.control}
              name="clinicId"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  label="Clinic"
                  placeholder="Choose a clinic"
                  data={currentUser.clinics.map((clinic) => ({ value: clinic.id, label: clinic.name }))}
                  error={fieldState.error?.message}
                  onChange={(value) => {
                    field.onChange(value);
                    // The chosen physiotherapist may not work at the new
                    // clinic, and the server would refuse the pairing.
                    form.setValue("physiotherapistId", "", { shouldDirty: true });
                  }}
                />
              )}
            />

            <Controller
              control={form.control}
              name="physiotherapistId"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  label="Physiotherapist"
                  placeholder={clinicId ? "Choose a physiotherapist" : "Choose a clinic first"}
                  data={physiotherapistOptions}
                  disabled={!clinicId || clinicUsers.isPending}
                  error={fieldState.error?.message}
                />
              )}
            />
          </>
        )}

        <Controller
          control={form.control}
          name="appointmentTime"
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              type="datetime-local"
              label="Date and time"
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={form.control}
          name="appointmentType"
          render={({ field, fieldState }) => (
            <Select
              {...field}
              label="Type"
              data={APPOINTMENT_TYPE_OPTIONS}
              error={fieldState.error?.message}
            />
          )}
        />

        {/* A Controller rather than `register`, matching every other field
            here. Fixed rows rather than `autosize`: nothing else in the app
            uses it, and Mantine's autosize hook needs layout measurement the
            jsdom component lane cannot provide. */}
        <Controller
          control={form.control}
          name="notes"
          render={({ field }) => <Textarea {...field} label="Notes" rows={3} />}
        />
      </Stack>
    </FormDialog>
  );
}
