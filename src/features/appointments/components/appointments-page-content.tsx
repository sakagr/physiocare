"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, useCan } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import { usersListQueryOptions } from "@/features/users";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { AppointmentsCollection } from "./appointments-collection";
import { AppointmentDetailDrawer } from "./appointment-detail-drawer";
import { AppointmentStatusActions } from "./appointment-status-actions";
import { AppointmentFormDialog } from "./appointment-form-dialog";

/** See `appointment-form-dialog.tsx`: the pagination validator caps this at 100. */
const PICKER_LIMIT = 100;

/**
 * The Appointments destination (`UX.md` → Screen Inventory).
 *
 * **No destination-level `Can` guard, and no capability on its nav item**
 * (F6, D11). Every org role reaches this page; the service layer scopes what
 * it contains -- Owner/Admin organization-wide, a physiotherapist to their
 * own appointments, a receptionist to their accessible clinics. A token for
 * `canViewAppointments` would be granted to every org user and gate nothing.
 *
 * What *is* gated is the framing: `appointments:oversee` reveals the
 * physiotherapist filter and column, and `appointments:manage` reveals the
 * scheduling action.
 *
 * This replaced the page's F6 `DestinationStub`. Before it, a physiotherapist
 * and a receptionist had no appointment surface at all -- `UX.md` routed their
 * daily work through a dashboard widget that does not arrive until F8.
 */
export function AppointmentsPageContent() {
  const currentUser = useCurrentUser();
  const canOversee = useCan("appointments:oversee");
  const canManage = useCan("appointments:manage");
  const [selected, setSelected] = useState<AppointmentRead | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentRead | null>(null);

  // `GET /api/users` is `canManageUsers` (Owner/Admin only), which is exactly
  // who holds `appointments:oversee` -- so the filter it feeds is only ever
  // requested by a caller allowed to make the call. Everyone else never
  // renders the filter, so the query stays disabled rather than 403-ing.
  const physiotherapists = useQuery({
    ...usersListQueryOptions({ page: 1, limit: PICKER_LIMIT, role: "ORG_PHYSIOTHERAPIST" }),
    enabled: canOversee,
  });

  const clinicOptions = currentUser.clinics.map((clinic) => ({
    value: clinic.id,
    label: clinic.name,
  }));

  const physiotherapistOptions = (physiotherapists.data?.items ?? []).map((user) => ({
    value: user.id,
    label: user.full_name,
  }));

  return (
    <>
      <PageHeader
        title="Appointments"
        description={
          canOversee
            ? "Every appointment across your staff and clinics."
            : "Your schedule."
        }
        primaryAction={
          canManage ? { label: "Schedule appointment", onClick: () => setScheduling(true) } : undefined
        }
      />

      <AppointmentsCollection
        canOversee={canOversee}
        clinicOptions={clinicOptions}
        physiotherapistOptions={physiotherapistOptions}
        onSelect={setSelected}
        emptyAction={canManage ? { label: "Schedule appointment", onClick: () => setScheduling(true) } : undefined}
        rowActions={(appointment) => (
          // Inline quick status actions on each row, so the common check-in is
          // a single action wherever the appointment appears (`UX.md`).
          <AppointmentStatusActions appointment={appointment} compact />
        )}
      />

      <AppointmentDetailDrawer
        appointment={selected}
        onClose={() => setSelected(null)}
        onReschedule={canManage ? (appointment) => setRescheduling(appointment) : undefined}
      />

      {/* Keyed on `opened` so a reopened dialog starts clean. */}
      <AppointmentFormDialog
        key={scheduling ? "schedule-open" : "schedule-closed"}
        opened={scheduling}
        onClose={() => setScheduling(false)}
      />

      <AppointmentFormDialog
        key={rescheduling?.id ?? "no-reschedule"}
        opened={rescheduling !== null}
        onClose={() => setRescheduling(null)}
        appointmentId={rescheduling?.id}
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
    </>
  );
}
