/**
 * Public surface of the `patients` feature (F5). Cross-feature imports go
 * through this barrel, never deep paths (AGENTS.md → Project Structure).
 * Explicit named exports only -- never `export *`.
 *
 * This module does not import `patient-packages` or `packages` in either
 * direction. The workspace takes its tabs as a prop, so the route composes
 * the features instead -- which is also what lets F6/F7 add tabs without
 * touching anything here.
 */
export {
  patientsQueryKeys,
  patientsListQueryOptions,
  patientDetailQueryOptions,
  patientRecordsQueryOptions,
} from "./queries";
export type { PatientListFilters, PatientRecordListFilters } from "./api";
export { PatientsPageContent } from "./components/patients-page-content";
export { PatientsCollection, type PatientsCollectionProps } from "./components/patients-collection";
export { PatientFormDialog, type PatientFormDialogProps } from "./components/patient-form-dialog";
export {
  PatientWorkspace,
  type PatientWorkspaceProps,
  type PatientWorkspaceTab,
} from "./components/patient-workspace";
export { PatientOverviewTab, type PatientOverviewTabProps } from "./components/patient-overview-tab";
export { PatientRecordsTab, type PatientRecordsTabProps } from "./components/patient-records-tab";
