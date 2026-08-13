"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Button, Group, Select, Stack, Text } from "@mantine/core";
import { ConfirmDialog, FormDialog } from "@/components/ui";
import { patientPackagesListQueryOptions } from "@/features/patient-packages";
import type { AppointmentRead, AppointmentStatus } from "@/types/contracts/appointment";
import { updateAppointmentStatus } from "../api";
import { appointmentsQueryKeys } from "../queries";
import { appointmentTransitionLabel } from "../status";
import { resyncOnConflict } from "../resync";

/**
 * The status controls for one appointment, rendered **directly from
 * `allowedTransitions`** (F6, D13).
 *
 * That field is the conjunction the server itself enforces -- may this caller
 * act on this row, and is the transition legal from its current status -- so
 * a control is offered only where the request would succeed, satisfying
 * `UX.md`'s "hidden or disabled rather than shown and then failing". **No
 * copy of the transition matrix exists anywhere on the client**; a `canManage`
 * boolean would have forced one, and it would have drifted silently.
 *
 * Two transitions are not plain buttons:
 *  - **completed** opens a package picker, since completing may consume a
 *    session.
 *  - **cancelled** opens a `ConfirmDialog` at the stronger tier -- `UX.md`
 *    names cancelling an appointment among the actions that must not offer
 *    Undo, because a cancellation reverses a consumed session and has already
 *    been communicated to the patient.
 */
export interface AppointmentStatusActionsProps {
  appointment: AppointmentRead;
  /** Extra query keys to invalidate, e.g. a patient workspace's tab. */
  extraInvalidateKeys?: readonly unknown[][];
  compact?: boolean;
}

export function AppointmentStatusActions({
  appointment,
  extraInvalidateKeys = [],
  compact = false,
}: AppointmentStatusActionsProps) {
  const queryClient = useQueryClient();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [patientPackageId, setPatientPackageId] = useState<string | null>(null);

  const invalidateKeys: readonly unknown[][] = [[...appointmentsQueryKeys.all], ...extraInvalidateKeys];

  const packages = useQuery({
    ...patientPackagesListQueryOptions(appointment.patient_id, { page: 1, limit: 50, status: "active" }),
    enabled: completing,
  });

  const transition = useMutation({
    mutationFn: (input: { status: AppointmentStatus; patientPackageId?: string }) =>
      updateAppointmentStatus(appointment.id, input),
    onSuccess: (_result, input) => {
      for (const queryKey of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
      notifications.show({
        color: "success",
        message: `Appointment ${appointmentTransitionLabel(input.status).toLowerCase()}d.`,
      });
      setConfirmingCancel(false);
      setCompleting(false);
      setPatientPackageId(null);
    },
    onError: (error) => {
      // The resync half of blocking-message + resync: the toast is already
      // raised by the cache-level policy from ERROR_BEHAVIORS; this refetches
      // so the stale row reflects where the appointment actually is now.
      resyncOnConflict(queryClient, error, invalidateKeys);
      setConfirmingCancel(false);
      setCompleting(false);
    },
  });

  function onTransition(status: AppointmentStatus) {
    if (status === "cancelled") {
      setConfirmingCancel(true);
      return;
    }
    if (status === "completed") {
      setCompleting(true);
      return;
    }
    transition.mutate({ status });
  }

  // `status` is derived by `patient_packages_view` and is time-dependent, so
  // the filter is applied server-side rather than in memory here.
  const packageOptions = (packages.data?.items ?? []).map((assignment) => ({
    value: assignment.id,
    label: `${assignment.package_name} · ${assignment.remaining_sessions} left`,
  }));

  return (
    <>
      <Group gap="xs" justify={compact ? "flex-end" : undefined} wrap="wrap">
        {appointment.allowedTransitions.map((status) => (
          <Button
            key={status}
            size={compact ? "compact-xs" : "xs"}
            variant={status === "cancelled" ? "subtle" : "light"}
            color={status === "cancelled" ? "red" : undefined}
            loading={transition.isPending && transition.variables?.status === status}
            onClick={(event) => {
              event.stopPropagation();
              onTransition(status);
            }}
          >
            {appointmentTransitionLabel(status)}
          </Button>
        ))}
      </Group>

      <ConfirmDialog
        opened={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        onConfirm={() => transition.mutate({ status: "cancelled" })}
        title="Cancel this appointment?"
        target={`${appointment.patient?.full_name ?? "This patient"}'s appointment`}
        consequence="The patient keeps their booking slot no longer, and any session consumed by this visit is returned. This cannot be undone."
        confirmLabel="Cancel appointment"
        cancelLabel="Keep appointment"
        loading={transition.isPending}
      />

      <FormDialog
        opened={completing}
        onClose={() => setCompleting(false)}
        title="Complete visit"
        submitLabel="Complete visit"
        isSubmitting={transition.isPending}
        onSubmit={() =>
          transition.mutate({
            status: "completed",
            patientPackageId: patientPackageId ?? undefined,
          })
        }
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Draw this visit from a package, or complete it as a chargeable visit.
          </Text>
          <Select
            label="Patient package"
            placeholder={packageOptions.length ? "Chargeable visit (no package)" : "No active packages"}
            data={packageOptions}
            value={patientPackageId}
            onChange={setPatientPackageId}
            disabled={packages.isPending || packageOptions.length === 0}
            clearable
          />
        </Stack>
      </FormDialog>
    </>
  );
}
