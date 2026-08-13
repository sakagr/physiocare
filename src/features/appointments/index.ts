/**
 * Public surface of the `appointments` feature (F6). Cross-feature imports go
 * through this barrel, never deep paths (`AGENTS.md` → *Project Structure*).
 * Explicit named exports only -- never `export *`.
 *
 * This module imports no other feature. The Patient Workspace tab is composed
 * at the route level, which is what keeps `patients` free of any dependency
 * on this one.
 *
 * There is deliberately **no dashboard widget here** (F6, D3): the dashboard
 * appointments surface is F8's entirely, component included. `UX.md`'s open
 * question about how it exposes fuller detail is unresolved and reassigned to
 * F8, so building the component ahead of that answer would be building
 * against a shape nobody has settled.
 */
export {
  appointmentsQueryKeys,
  appointmentsListQueryOptions,
  appointmentDetailQueryOptions,
} from "./queries";
export type { AppointmentListFilters, AppointmentFormRequest, AppointmentRescheduleRequest } from "./api";
export {
  appointmentStatusRole,
  appointmentStatusLabel,
  appointmentTransitionLabel,
  APPOINTMENT_TYPE_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
} from "./status";
export {
  appointmentFormSchema,
  EMPTY_APPOINTMENT_FORM_VALUES,
  type AppointmentFormValues,
} from "./schemas";
export { RESYNC_ERROR_CODES, isResyncError, resyncOnConflict } from "./resync";
export { AppointmentsPageContent } from "./components/appointments-page-content";
export {
  AppointmentsCollection,
  formatAppointmentTime,
  type AppointmentsCollectionProps,
} from "./components/appointments-collection";
export {
  AppointmentDetailDrawer,
  type AppointmentDetailDrawerProps,
} from "./components/appointment-detail-drawer";
export {
  PatientAppointmentsTab,
  type PatientAppointmentsTabProps,
} from "./components/patient-appointments-tab";
export {
  AppointmentFormDialog,
  type AppointmentFormDialogProps,
} from "./components/appointment-form-dialog";
export {
  AppointmentStatusActions,
  type AppointmentStatusActionsProps,
} from "./components/appointment-status-actions";
