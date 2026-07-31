import { api } from "@/lib/api/client";
import type { Clinic, ClinicListResponse } from "@/types/contracts/clinic";

/** The Clinics commands and reads, as typed calls against `/api` (F3). */

export interface ClinicListFilters {
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

export function listClinics(filters: ClinicListFilters): Promise<ClinicListResponse> {
  return api.get<ClinicListResponse>(`/api/clinics${buildQueryString(filters)}`);
}

export function getClinic(id: string): Promise<Clinic> {
  return api.get<Clinic>(`/api/clinics/${id}`);
}

export interface ClinicFormRequest {
  clinicName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
}

export function createClinic(input: ClinicFormRequest): Promise<Clinic> {
  return api.post<Clinic>("/api/clinics", input);
}

export function updateClinic(id: string, input: Partial<ClinicFormRequest>): Promise<Clinic> {
  return api.patch<Clinic>(`/api/clinics/${id}`, input);
}

export function activateClinic(id: string): Promise<Clinic> {
  return api.post<Clinic>(`/api/clinics/${id}/activate`);
}

export function deactivateClinic(id: string): Promise<Clinic> {
  return api.post<Clinic>(`/api/clinics/${id}/deactivate`);
}
