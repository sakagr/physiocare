import { queryOptions } from "@tanstack/react-query";
import {
  listPatients,
  getPatient,
  listPatientRecords,
  type PatientListFilters,
  type PatientRecordListFilters,
} from "./api";

export const patientsQueryKeys = {
  all: ["patients"] as const,
  list: (filters: PatientListFilters) => ["patients", "list", filters] as const,
  detail: (id: string) => ["patients", "detail", id] as const,
  records: (patientId: string, filters: PatientRecordListFilters) =>
    ["patients", "records", patientId, filters] as const,
  allRecords: (patientId: string) => ["patients", "records", patientId] as const,
};

export function patientsListQueryOptions(filters: PatientListFilters) {
  return queryOptions({
    queryKey: patientsQueryKeys.list(filters),
    queryFn: () => listPatients(filters),
  });
}

export function patientDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: patientsQueryKeys.detail(id),
    queryFn: () => getPatient(id),
    enabled: Boolean(id),
  });
}

/**
 * The signed download URLs in this response expire after 300 s
 * (`patient-record.service.ts`), so the list is deliberately short-lived and
 * refetches on focus. A download click uses the freshest fetched URL; nothing
 * persists a URL across a long-open workspace.
 */
export function patientRecordsQueryOptions(patientId: string, filters: PatientRecordListFilters) {
  return queryOptions({
    queryKey: patientsQueryKeys.records(patientId, filters),
    queryFn: () => listPatientRecords(patientId, filters),
    enabled: Boolean(patientId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
