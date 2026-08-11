import { api } from "@/lib/api/client";
import type { Patient, PatientListResponse } from "@/types/contracts/patient";
import type {
  PatientRecord,
  PatientRecordListResponse,
} from "@/types/contracts/patient-record";

/** The Patients and patient-records commands and reads (F5). */

export interface PatientListFilters {
  page: number;
  limit: number;
  search?: string;
  gender?: string;
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

export function listPatients(filters: PatientListFilters): Promise<PatientListResponse> {
  return api.get<PatientListResponse>(`/api/patients${buildQueryString(filters)}`);
}

export function getPatient(id: string): Promise<Patient> {
  return api.get<Patient>(`/api/patients/${id}`);
}

export interface PatientFormRequest {
  fullName: string;
  gender?: string;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
}

export function createPatient(input: PatientFormRequest): Promise<Patient> {
  return api.post<Patient>("/api/patients", input);
}

export function updatePatient(id: string, input: Partial<PatientFormRequest>): Promise<Patient> {
  return api.patch<Patient>(`/api/patients/${id}`, input);
}

export function deletePatient(id: string): Promise<Patient> {
  return api.delete<Patient>(`/api/patients/${id}`);
}

export interface PatientRecordListFilters {
  page: number;
  limit: number;
}

export function listPatientRecords(
  patientId: string,
  filters: PatientRecordListFilters
): Promise<PatientRecordListResponse> {
  return api.get<PatientRecordListResponse>(
    `/api/patients/${patientId}/records${buildQueryString(filters)}`
  );
}

export interface PatientRecordUploadRequest {
  file: File;
  recordType: string;
  title: string;
  notes?: string;
}

/**
 * Multipart, not JSON: the route reads `request.formData()` and validates
 * file size and MIME type itself (FL4).
 */
export function uploadPatientRecord(
  patientId: string,
  input: PatientRecordUploadRequest
): Promise<PatientRecord> {
  const form = new FormData();
  form.set("file", input.file);
  form.set("recordType", input.recordType);
  form.set("title", input.title);
  if (input.notes) {
    form.set("notes", input.notes);
  }
  return api.postForm<PatientRecord>(`/api/patients/${patientId}/records`, form);
}

export function deletePatientRecord(patientId: string, recordId: string): Promise<PatientRecord> {
  return api.delete<PatientRecord>(`/api/patients/${patientId}/records/${recordId}`);
}
