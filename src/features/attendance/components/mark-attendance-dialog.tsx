"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Alert, List, Select, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import {
  LIMIT_ENFORCEMENT_CODES,
  LimitEnforcementState,
  limitEnforcementCode,
} from "@/features/organization";
import { clinicUsersQueryOptions } from "@/features/user-clinics";
import { isResyncError, resyncOnConflict } from "@/features/appointments";
import type { RecordAttendanceResult } from "@/types/contracts/attendance";
import { correctAttendance, recordAttendance } from "../api";
import { attendanceQueryKeys } from "../queries";
import {
  ATTENDANCE_STATUS_OPTIONS,
  HALF_DAY_WINDOWS,
  HALF_DAY_WINDOW_OPTIONS,
  attendanceFormSchema,
  describeStoredWindow,
  halfDayWindowValue,
  makesUnavailable,
  type AttendanceFormValues,
} from "../schemas";

/**
 * Mark attendance, or correct a recorded row (`UX.md` Flow 14).
 *
 * **The two halves are gated independently, never one as a superset of the
 * other** (F6, D11). `attendance:record` and `attendance:manage` *cross*: a
 * physiotherapist records their own attendance and not another's; a
 * receptionist records another's and not their own; Owner and Admin hold
 * both. Deriving the self path from the manage path would let a receptionist
 * record their own attendance, which `canRecordOwnAttendance` refuses by
 * deliberate clinic policy.
 *
 * The target-user picker reads `GET /api/clinics/{id}/users`, clinic first --
 * `GET /api/users` is Owner/Admin-only, so Reception could not populate it,
 * and clinic-then-user mirrors the rule the server enforces anyway
 * (`recordCheckIn` refuses a target not assigned to that clinic).
 */
export interface MarkAttendanceDialogProps {
  opened: boolean;
  onClose: () => void;
  /** May record their own attendance (`attendance:record`). */
  canRecordOwn: boolean;
  /** May record for other staff (`attendance:manage`). */
  canManageOthers: boolean;
  /** Present when correcting an existing row rather than recording a new one. */
  correcting?: {
    id: string;
    status: string;
    notes: string | null;
    unavailable_from: string | null;
    unavailable_to: string | null;
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The workflow's four id arrays, reported rather than collapsed into a bare
 * success. A marking that cleared six visits, skipped a patient already at
 * the desk, and failed two notifications is not honestly "Attendance
 * recorded".
 */
function EffectSummary({ result }: { result: RecordAttendanceResult }) {
  const lines: string[] = [];
  if (result.cancelledAppointmentIds.length > 0) {
    lines.push(`${result.cancelledAppointmentIds.length} appointment(s) cancelled.`);
  }
  if (result.skippedCheckedInAppointmentIds.length > 0) {
    lines.push(
      `${result.skippedCheckedInAppointmentIds.length} already checked in and left alone — cancel those with the patient present.`
    );
  }
  if (result.failedCancellationIds.length > 0) {
    lines.push(`${result.failedCancellationIds.length} could not be cancelled and still stand.`);
  }
  if (result.failedNotificationAppointmentIds.length > 0) {
    lines.push(
      `${result.failedNotificationAppointmentIds.length} patient(s) were not notified — contact them directly.`
    );
  }
  if (lines.length === 0) return null;

  const hasFailure =
    result.failedCancellationIds.length > 0 || result.failedNotificationAppointmentIds.length > 0;

  return (
    <Alert color={hasFailure ? "orange" : "blue"} role="status" title="What this changed">
      <List size="sm">
        {lines.map((line) => (
          <List.Item key={line}>{line}</List.Item>
        ))}
      </List>
    </Alert>
  );
}

export function MarkAttendanceDialog({
  opened,
  onClose,
  canRecordOwn,
  canManageOthers,
  correcting,
}: MarkAttendanceDialogProps) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const [enforcement, setEnforcement] = useState<ReturnType<typeof limitEnforcementCode>>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [result, setResult] = useState<RecordAttendanceResult | null>(null);

  const storedWindow = correcting
    ? describeStoredWindow(correcting.unavailable_from, correcting.unavailable_to)
    : null;
  const storedWindowValue =
    correcting?.unavailable_from && correcting.unavailable_to
      ? halfDayWindowValue(correcting.unavailable_from, correcting.unavailable_to)
      : "";
  const storedWindowIsKnown = HALF_DAY_WINDOW_OPTIONS.some(
    (option) => option.value === storedWindowValue
  );

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      userId: "",
      clinicId: currentUser.clinics[0]?.id ?? "",
      attendanceDate: todayIso(),
      status: correcting?.status ?? "present",
      // A stored window matching neither pinned choice is left unselected, so
      // changing it is an explicit act rather than a silent snap.
      halfDayWindow: storedWindowIsKnown ? storedWindowValue : "",
      notes: correcting?.notes ?? "",
    },
  });

  // `useWatch` rather than `form.watch` -- see appointment-form-dialog.tsx.
  const clinicId = useWatch({ control: form.control, name: "clinicId" });
  const status = useWatch({ control: form.control, name: "status" });

  const clinicUsers = useQuery({
    ...clinicUsersQueryOptions(clinicId),
    enabled: opened && canManageOthers && Boolean(clinicId),
  });

  const invalidateKeys: readonly unknown[][] = [
    [...attendanceQueryKeys.all],
    ["appointments"],
  ];

  const save = useMutation({
    mutationFn: (values: AttendanceFormValues) => {
      const window = HALF_DAY_WINDOWS.find(
        (candidate) => halfDayWindowValue(candidate.from, candidate.to) === values.halfDayWindow
      );
      const windowFields =
        values.status === "half_day" && window
          ? { unavailableFrom: window.from, unavailableTo: window.to }
          : {};

      return correcting
        ? correctAttendance(correcting.id, {
            status: values.status,
            notes: values.notes,
            ...windowFields,
          })
        : recordAttendance({
            userId: values.userId || undefined,
            clinicId: values.clinicId,
            attendanceDate: values.attendanceDate,
            status: values.status,
            notes: values.notes,
            ...windowFields,
          });
    },
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: (saved) => {
      for (const queryKey of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
      notifications.show({
        color: "success",
        message: correcting ? "Attendance corrected." : "Attendance recorded.",
      });
      // Held open when the marking had downstream effects: closing on a bare
      // success would hide what it did to the schedule.
      const hadEffects =
        saved.cancelledAppointmentIds.length > 0 ||
        saved.skippedCheckedInAppointmentIds.length > 0 ||
        saved.failedCancellationIds.length > 0 ||
        saved.failedNotificationAppointmentIds.length > 0;
      if (hadEffects) setResult(saved);
      else onClose();
    },
    onError: (error) => {
      setEnforcement(limitEnforcementCode(error));
      if (isResyncError(error)) {
        setConflict("This person's attendance for that date has already been recorded. The board has been refreshed.");
        resyncOnConflict(queryClient, error, invalidateKeys);
        return;
      }
      setConflict(null);
      applyFieldErrors(error, form.setError);
    },
  });

  const staffOptions = (clinicUsers.data ?? []).map((user) => ({
    value: user.id,
    label: `${user.full_name}${user.role ? ` · ${user.role.display_name}` : ""}`,
  }));

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title={correcting ? "Correct attendance" : "Mark attendance"}
      submitLabel={correcting ? "Save correction" : "Record"}
      isDirty={form.formState.isDirty}
      isSubmitting={save.isPending}
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
    >
      <Stack gap="sm">
        {enforcement && <LimitEnforcementState code={enforcement} />}
        {conflict && (
          <Alert color="orange" role="alert">
            {conflict}
          </Alert>
        )}
        {result && <EffectSummary result={result} />}

        {!correcting && (
          <>
            <Controller
              control={form.control}
              name="clinicId"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  label="Clinic"
                  data={currentUser.clinics.map((clinic) => ({ value: clinic.id, label: clinic.name }))}
                  error={fieldState.error?.message}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("userId", "", { shouldDirty: true });
                  }}
                />
              )}
            />

            {canManageOthers && (
              <Controller
                control={form.control}
                name="userId"
                render={({ field, fieldState }) => (
                  <Select
                    {...field}
                    label="Staff member"
                    // The two capabilities cross, so the placeholder must not
                    // imply that leaving it blank records for the caller when
                    // they may not record for themselves.
                    placeholder={canRecordOwn ? "Myself" : "Choose a staff member"}
                    data={staffOptions}
                    disabled={!clinicId || clinicUsers.isPending}
                    clearable={canRecordOwn}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
            )}

            <Controller
              control={form.control}
              name="attendanceDate"
              render={({ field, fieldState }) => (
                <TextInput {...field} type="date" label="Date" error={fieldState.error?.message} />
              )}
            />
          </>
        )}

        <Controller
          control={form.control}
          name="status"
          render={({ field, fieldState }) => (
            <Select
              {...field}
              label="Status"
              data={ATTENDANCE_STATUS_OPTIONS}
              error={fieldState.error?.message}
            />
          )}
        />

        {status === "half_day" && (
          <Controller
            control={form.control}
            name="halfDayWindow"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                label="Unavailable window"
                description="The period they are NOT available."
                placeholder={
                  storedWindow && !storedWindowIsKnown
                    ? `Currently ${storedWindow} — choose to change it`
                    : "Choose a half"
                }
                data={HALF_DAY_WINDOW_OPTIONS}
                error={fieldState.error?.message}
              />
            )}
          />
        )}

        {makesUnavailable(status) && (
          <Text size="sm" c="dimmed">
            Appointments in the affected period will be cancelled and those patients notified.
          </Text>
        )}

        <Controller
          control={form.control}
          name="notes"
          render={({ field }) => <Textarea {...field} label="Notes" rows={2} />}
        />
      </Stack>
    </FormDialog>
  );
}
