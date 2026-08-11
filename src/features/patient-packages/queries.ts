import { queryOptions } from "@tanstack/react-query";
import {
  listPatientPackages,
  listPackageUsage,
  type PatientPackageListFilters,
  type PackageUsageListFilters,
} from "./api";

export const patientPackagesQueryKeys = {
  all: ["patient-packages"] as const,
  list: (patientId: string, filters: PatientPackageListFilters) =>
    ["patient-packages", "list", patientId, filters] as const,
  allForPatient: (patientId: string) => ["patient-packages", "list", patientId] as const,
  usage: (patientPackageId: string, filters: PackageUsageListFilters) =>
    ["patient-packages", "usage", patientPackageId, filters] as const,
};

/**
 * The assignment list. `status` is derived by `patient_packages_view` and is
 * **time-dependent** -- an `active` row becomes `expired` at midnight with no
 * write anywhere -- so this refetches on focus, a per-module promotion UX.md
 * already permits. Never re-derive the status client-side: the precedence
 * rule lives in the view, and a second implementation would drift.
 */
export function patientPackagesListQueryOptions(patientId: string, filters: PatientPackageListFilters) {
  return queryOptions({
    queryKey: patientPackagesQueryKeys.list(patientId, filters),
    queryFn: () => listPatientPackages(patientId, filters),
    enabled: Boolean(patientId),
    refetchOnWindowFocus: true,
  });
}

export function packageUsageQueryOptions(patientPackageId: string, filters: PackageUsageListFilters) {
  return queryOptions({
    queryKey: patientPackagesQueryKeys.usage(patientPackageId, filters),
    queryFn: () => listPackageUsage(patientPackageId, filters),
    enabled: Boolean(patientPackageId),
  });
}
