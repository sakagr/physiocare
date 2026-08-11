/**
 * Public surface of the `packages` feature (F5). Cross-feature imports go
 * through this barrel, never deep paths (AGENTS.md → Project Structure).
 * Explicit named exports only -- never `export *`.
 *
 * `patient-packages` does not import this module. The assign dialog's package
 * picker is supplied by the route-level composition instead, which is what
 * keeps the two features independent in both directions.
 */
export { packagesQueryKeys, packagesListQueryOptions } from "./queries";
export type { PackageListFilters } from "./api";
export { PackagesPageContent } from "./components/packages-page-content";
export { PackagesCollection, type PackagesCollectionProps } from "./components/packages-collection";
export { PackageFormDialog, type PackageFormDialogProps } from "./components/package-form-dialog";
