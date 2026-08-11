import { api } from "@/lib/api/client";
import type {
  PatientPackage,
  PatientPackageListResponse,
  PackageSessionUsageListResponse,
} from "@/types/contracts/patient-package";

/** Patient package assignment commands and reads (F5). */

export interface PatientPackageListFilters {
  page: number;
  limit: number;
  status?: string;
}

function buildQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters) as [string, string | number | boolean | undefined][]) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listPatientPackages(
  patientId: string,
  filters: PatientPackageListFilters
): Promise<PatientPackageListResponse> {
  return api.get<PatientPackageListResponse>(
    `/api/patients/${patientId}/packages${buildQueryString(filters)}`
  );
}

export interface AssignPackageRequest {
  packageId: string;
  purchasedOn?: string;
}

export function assignPackage(patientId: string, input: AssignPackageRequest): Promise<PatientPackage> {
  return api.post<PatientPackage>(`/api/patients/${patientId}/packages`, input);
}

export function cancelPatientPackage(patientPackageId: string): Promise<PatientPackage> {
  return api.patch<PatientPackage>(`/api/patient-packages/${patientPackageId}`, { status: "cancelled" });
}

export function extendPatientPackageValidity(
  patientPackageId: string,
  extendedValidityTo: string
): Promise<PatientPackage> {
  return api.patch<PatientPackage>(`/api/patient-packages/${patientPackageId}`, { extendedValidityTo });
}

export function deletePatientPackage(patientPackageId: string): Promise<PatientPackage> {
  return api.delete<PatientPackage>(`/api/patient-packages/${patientPackageId}`);
}

export interface PackageUsageListFilters {
  page: number;
  limit: number;
}

export function listPackageUsage(
  patientPackageId: string,
  filters: PackageUsageListFilters
): Promise<PackageSessionUsageListResponse> {
  return api.get<PackageSessionUsageListResponse>(
    `/api/patient-packages/${patientPackageId}/usage${buildQueryString(filters)}`
  );
}
