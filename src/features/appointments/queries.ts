import { queryOptions } from "@tanstack/react-query";
import { listAppointments, getAppointment, type AppointmentListFilters } from "./api";

export const appointmentsQueryKeys = {
  all: ["appointments"] as const,
  list: (filters: AppointmentListFilters) => ["appointments", "list", filters] as const,
  detail: (id: string) => ["appointments", "detail", id] as const,
};

export function appointmentsListQueryOptions(filters: AppointmentListFilters) {
  return queryOptions({
    queryKey: appointmentsQueryKeys.list(filters),
    queryFn: () => listAppointments(filters),
  });
}

export function appointmentDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: appointmentsQueryKeys.detail(id),
    queryFn: () => getAppointment(id),
    enabled: Boolean(id),
  });
}
