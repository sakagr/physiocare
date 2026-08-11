import { api } from "@/lib/api/client";
import type { Package, PackageListResponse } from "@/types/contracts/package";

/** The Packages catalogue commands and reads, as typed calls against `/api` (F5). */

export interface PackageListFilters {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
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

export function listPackages(filters: PackageListFilters): Promise<PackageListResponse> {
  return api.get<PackageListResponse>(`/api/packages${buildQueryString(filters)}`);
}

export interface PackageFormRequest {
  packageName: string;
  totalSessions: number;
  packagePrice: number;
  validityDays: number;
}

export function createPackage(input: PackageFormRequest): Promise<Package> {
  return api.post<Package>("/api/packages", input);
}

export function updatePackage(id: string, input: Partial<PackageFormRequest>): Promise<Package> {
  return api.patch<Package>(`/api/packages/${id}`, input);
}

export function activatePackage(id: string): Promise<Package> {
  return api.post<Package>(`/api/packages/${id}/activate`);
}

export function deactivatePackage(id: string): Promise<Package> {
  return api.post<Package>(`/api/packages/${id}/deactivate`);
}

export function deletePackage(id: string): Promise<Package> {
  return api.delete<Package>(`/api/packages/${id}`);
}
