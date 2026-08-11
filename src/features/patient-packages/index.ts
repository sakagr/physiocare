/**
 * Public surface of the `patient-packages` feature (F5). Cross-feature
 * imports go through this barrel, never deep paths (AGENTS.md → Project
 * Structure). Explicit named exports only -- never `export *`.
 *
 * This module imports neither `patients` nor `packages`. Its tab is mounted
 * by the workspace route, and its package picker takes its options as a prop
 * from that same composition.
 */
export {
  patientPackagesQueryKeys,
  patientPackagesListQueryOptions,
  packageUsageQueryOptions,
} from "./queries";
export type { PatientPackageListFilters, PackageUsageListFilters } from "./api";
export { PatientPackagesTab, type PatientPackagesTabProps } from "./components/patient-packages-tab";
export { AssignPackageDialog, type AssignPackageDialogProps } from "./components/assign-package-dialog";
export { ExtendValidityDialog, type ExtendValidityDialogProps } from "./components/extend-validity-dialog";
export { PackageUsageDrawer, type PackageUsageDrawerProps } from "./components/package-usage-drawer";
