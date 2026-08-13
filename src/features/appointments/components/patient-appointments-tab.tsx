"use client";

import { useState } from "react";
import { Button, Group, Stack } from "@mantine/core";
import { useCan } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { AppointmentsCollection } from "./appointments-collection";
import { AppointmentDetailDrawer } from "./appointment-detail-drawer";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { AppointmentStatusActions } from "./appointment-status-actions";

/**
 * One patient's appointments, as a Patient Workspace tab.
 *
 * Owned by `appointments` and composed at the workspace route, which is what
 * lets it exist without `patients` importing this feature or this feature
 * importing `patients` (`AGENTS.md` → *Project Structure*: dependencies point
 * down, never sideways). The workspace takes its tabs as a prop precisely so
 * F6 could append one without touching F5's shell.
 *
 * The physiotherapist framing is off here regardless of capability: this list
 * is one patient's, so a staff filter over it answers nothing useful.
 */
export interface PatientAppointmentsTabProps {
  patientId: string;
}

export function PatientAppointmentsTab({ patientId }: PatientAppointmentsTabProps) {
  const currentUser = useCurrentUser();
  const canManage = useCan("appointments:manage");
  const [selected, setSelected] = useState<AppointmentRead | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentRead | null>(null);

  const clinicOptions = currentUser.clinics.map((clinic) => ({ value: clinic.id, label: clinic.name }));
  const extraInvalidateKeys: readonly unknown[][] = [["patients", "detail", patientId]];

  return (
    <Stack gap="md">
      {canManage && (
        <Group justify="flex-end">
          <Button size="xs" onClick={() => setScheduling(true)}>
            Schedule appointment
          </Button>
        </Group>
      )}

      <AppointmentsCollection
        canOversee={false}
        clinicOptions={clinicOptions}
        patientId={patientId}
        onSelect={setSelected}
        emptyAction={canManage ? { label: "Schedule appointment", onClick: () => setScheduling(true) } : undefined}
        rowActions={(appointment) => (
          <AppointmentStatusActions
            appointment={appointment}
            extraInvalidateKeys={extraInvalidateKeys}
            compact
          />
        )}
      />

      <AppointmentDetailDrawer
        appointment={selected}
        onClose={() => setSelected(null)}
        onReschedule={canManage ? setRescheduling : undefined}
        extraInvalidateKeys={extraInvalidateKeys}
      />

      <AppointmentFormDialog
        key={scheduling ? "schedule-open" : "schedule-closed"}
        opened={scheduling}
        onClose={() => setScheduling(false)}
        lockedPatientId={patientId}
        extraInvalidateKeys={extraInvalidateKeys}
      />

      <AppointmentFormDialog
        key={rescheduling?.id ?? "no-reschedule"}
        opened={rescheduling !== null}
        onClose={() => setRescheduling(null)}
        appointmentId={rescheduling?.id}
        extraInvalidateKeys={extraInvalidateKeys}
        defaultValues={
          rescheduling
            ? {
                patientId: rescheduling.patient_id,
                clinicId: rescheduling.clinic_id,
                physiotherapistId: rescheduling.physiotherapist_id,
                appointmentTime: rescheduling.appointment_time.slice(0, 16),
                appointmentType: rescheduling.appointment_type,
                notes: rescheduling.notes ?? "",
              }
            : undefined
        }
      />
    </Stack>
  );
}
