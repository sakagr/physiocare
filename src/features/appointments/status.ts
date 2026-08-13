import type { SemanticRole } from "@/lib/theme";
import type { AppointmentStatus } from "@/types/contracts/appointment";

/**
 * Appointment status → semantic role and label.
 *
 * Owned by this feature, not by `StatusBadge`: the primitive is domain-blind
 * and never learns these names (`AGENTS.md` → *Shared UI primitives*). The
 * feature passes the mapped role in.
 *
 * The roles carry the clinic's reading of each state, not a colour choice:
 * `completed` is the only success (a visit delivered), `cancelled` is the
 * only danger (a visit that will not happen and may have downstream effects),
 * `no_show` is a warning rather than a danger because it is a fact about the
 * patient rather than an action taken, and the three in-flight states are
 * neutral or informational because nothing has gone wrong yet.
 */
const APPOINTMENT_STATUS_META: Record<
  AppointmentStatus,
  { role: SemanticRole; label: string }
> = {
  scheduled: { role: "neutral", label: "Scheduled" },
  confirmed: { role: "info", label: "Confirmed" },
  checked_in: { role: "info", label: "Checked in" },
  completed: { role: "success", label: "Completed" },
  cancelled: { role: "danger", label: "Cancelled" },
  no_show: { role: "warning", label: "No show" },
};

export function appointmentStatusRole(status: AppointmentStatus): SemanticRole {
  return APPOINTMENT_STATUS_META[status].role;
}

export function appointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_META[status].label;
}

/**
 * The verb for *moving into* a status, used on the transition controls
 * rendered from `allowedTransitions`. Distinct from the status label: the
 * control says what it will do ("Check in"), the badge says where the
 * appointment is ("Checked in").
 */
const APPOINTMENT_TRANSITION_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Reopen",
  confirmed: "Confirm",
  checked_in: "Check in",
  completed: "Complete visit",
  cancelled: "Cancel",
  no_show: "Mark no-show",
};

export function appointmentTransitionLabel(status: AppointmentStatus): string {
  return APPOINTMENT_TRANSITION_LABELS[status];
}

/** The appointment types, for the schedule form's picker. */
export const APPOINTMENT_TYPE_OPTIONS = [
  { value: "initial_consultation", label: "Initial consultation" },
  { value: "follow_up", label: "Follow-up" },
  { value: "therapy_session", label: "Therapy session" },
  { value: "assessment", label: "Assessment" },
];

export const APPOINTMENT_STATUS_OPTIONS = (
  Object.keys(APPOINTMENT_STATUS_META) as AppointmentStatus[]
).map((status) => ({ value: status, label: appointmentStatusLabel(status) }));
