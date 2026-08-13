"use client";

import Link from "next/link";
import { Anchor, Divider, Group, Stack, Text } from "@mantine/core";
import { DetailDrawer, StatusBadge } from "@/components/ui";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { appointmentStatusLabel, appointmentStatusRole } from "../status";
import { formatAppointmentTime } from "./appointments-collection";
import { AppointmentStatusActions } from "./appointment-status-actions";

/**
 * Appointment detail, over the list that opened it (`UX.md` → *Appointment
 * check-in & detail*). Hosted on the Appointments destination and the Patient
 * Workspace tab.
 *
 * Renders the display projection -- patient, physiotherapist and clinic
 * *names* -- never the ids the row carries (D1). Reschedule is offered here
 * rather than inline: it is a form, and `UX.md` puts fuller detail and
 * reschedule behind the drawer while the common check-in stays a single
 * inline action on the row.
 */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start" gap="lg">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {value}
      </Text>
    </Group>
  );
}

export interface AppointmentDetailDrawerProps {
  appointment: AppointmentRead | null;
  onClose: () => void;
  onReschedule?: (appointment: AppointmentRead) => void;
  extraInvalidateKeys?: readonly unknown[][];
}

export function AppointmentDetailDrawer({
  appointment,
  onClose,
  onReschedule,
  extraInvalidateKeys,
}: AppointmentDetailDrawerProps) {
  return (
    <DetailDrawer
      opened={appointment !== null}
      onClose={onClose}
      title={appointment?.patient?.full_name ?? "Appointment"}
      subtitle={appointment ? formatAppointmentTime(appointment.appointment_time) : undefined}
      footer={
        appointment ? (
          <Group gap="xs" wrap="wrap">
            <AppointmentStatusActions
              appointment={appointment}
              extraInvalidateKeys={extraInvalidateKeys}
            />
            {onReschedule && (
              <Anchor component="button" type="button" size="sm" onClick={() => onReschedule(appointment)}>
                Reschedule
              </Anchor>
            )}
          </Group>
        ) : null
      }
    >
      {appointment && (
        <Stack gap="sm">
          <Group>
            <StatusBadge
              role={appointmentStatusRole(appointment.status)}
              label={appointmentStatusLabel(appointment.status)}
            />
          </Group>

          <Divider />

          <DetailRow label="Patient" value={appointment.patient?.full_name ?? "—"} />
          <DetailRow label="Patient code" value={appointment.patient?.patient_code ?? "—"} />
          <DetailRow label="Physiotherapist" value={appointment.physiotherapist?.full_name ?? "—"} />
          <DetailRow label="Clinic" value={appointment.clinic?.clinic_name ?? "—"} />
          <DetailRow label="When" value={formatAppointmentTime(appointment.appointment_time)} />
          <DetailRow label="Notes" value={appointment.notes || "—"} />

          {/* The consultation destination, offered only where the caller may
              actually author it (D14 -- this one hint also governs the
              prescription section inside). */}
          {appointment.canManageConsultation && (
            <>
              <Divider />
              <Anchor component={Link} href={`/app/appointments/${appointment.id}/consultation`} size="sm">
                Open consultation
              </Anchor>
            </>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
