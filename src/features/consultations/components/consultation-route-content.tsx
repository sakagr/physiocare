"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton, Stack, Text } from "@mantine/core";
import { DataState, PageHeader } from "@/components/ui";
import { appointmentDetailQueryOptions, formatAppointmentTime } from "@/features/appointments";
import { PrescriptionsSection } from "@/features/prescriptions";
import { ConsultationForm } from "./consultation-form";
import { consultationForAppointmentQueryOptions } from "../queries";

/**
 * The Consultation destination, `/app/appointments/[id]/consultation`.
 *
 * A nested destination (ADR-0001's sanctioned "child that is itself a
 * substantial workspace"), so its header carries the parent and a return
 * path.
 *
 * Two reads, both keyed by the appointment id the route already has: the
 * appointment for the pinned patient context and the `canManageConsultation`
 * hint, and the consultation itself. A `null` consultation renders the create
 * form and a present one the edit form -- **no 409-as-control-flow anywhere**,
 * which is the whole reason D5 added the endpoint.
 *
 * The single hint gates both the consultation form and the prescription
 * section (D14). A caller who may read but not author -- a receptionist at
 * the appointment's clinic -- sees the record read-only rather than a
 * forbidden frame, because they legitimately may see it.
 */
export function ConsultationRouteContent({ appointmentId }: { appointmentId: string }) {
  const appointment = useQuery(appointmentDetailQueryOptions(appointmentId));
  const consultation = useQuery(consultationForAppointmentQueryOptions(appointmentId));

  const canManage = appointment.data?.canManageConsultation ?? false;

  return (
    <>
      <PageHeader
        title="Consultation"
        description={
          appointment.data
            ? `${appointment.data.patient?.full_name ?? "Patient"} · ${formatAppointmentTime(
                appointment.data.appointment_time
              )}`
            : undefined
        }
        parent={{ label: "Appointments", href: "/app/appointments" }}
      />

      <DataState
        isLoading={appointment.isPending || consultation.isPending}
        isError={appointment.isError || consultation.isError}
        error={appointment.error ?? consultation.error}
        onRetry={() => {
          void appointment.refetch();
          void consultation.refetch();
        }}
        skeleton={
          <Stack gap="md">
            <Skeleton height={280} radius="sm" />
            <Skeleton height={160} radius="sm" />
          </Stack>
        }
      >
        <Stack gap="lg" pb="xl">
          {!canManage && (
            <Text size="sm" c="dimmed">
              You can view this visit&apos;s clinical record but not change it.
            </Text>
          )}

          <ConsultationForm
            appointmentId={appointmentId}
            consultation={consultation.data ?? null}
            canManage={canManage}
          />

          {/* Prescriptions hang off the consultation, so the section appears
              only once the visit has actually been recorded. */}
          {consultation.data && (
            <PrescriptionsSection consultationId={consultation.data.id} canManage={canManage} />
          )}
        </Stack>
      </DataState>
    </>
  );
}
