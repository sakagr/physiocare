/**
 * Public surface of the `clinics` feature (F3). Cross-feature imports go
 * through this barrel, never deep paths (AGENTS.md → Project Structure).
 * Explicit named exports only -- never `export *`.
 */
export { clinicsQueryKeys, clinicsListQueryOptions, clinicDetailQueryOptions } from "./queries";
export type { ClinicListFilters } from "./api";
export { ClinicsPageContent } from "./components/clinics-page-content";
export { ClinicsCollection } from "./components/clinics-collection";
export { ClinicFormDialog, type ClinicFormDialogProps } from "./components/clinic-form-dialog";
export { ClinicDetailDrawer, type ClinicDetailDrawerProps } from "./components/clinic-detail-drawer";
