import { queryOptions } from "@tanstack/react-query";
import { listClinics, getClinic, type ClinicListFilters } from "./api";

export const clinicsQueryKeys = {
  all: ["clinics"] as const,
  list: (filters: ClinicListFilters) => ["clinics", "list", filters] as const,
  detail: (id: string) => ["clinics", "detail", id] as const,
};

export function clinicsListQueryOptions(filters: ClinicListFilters) {
  return queryOptions({
    queryKey: clinicsQueryKeys.list(filters),
    queryFn: () => listClinics(filters),
  });
}

export function clinicDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: clinicsQueryKeys.detail(id),
    queryFn: () => getClinic(id),
    enabled: Boolean(id),
  });
}
