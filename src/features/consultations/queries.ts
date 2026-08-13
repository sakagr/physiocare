import { queryOptions } from "@tanstack/react-query";
import { getConsultationForAppointment } from "./api";

export const consultationsQueryKeys = {
  all: ["consultations"] as const,
  forAppointment: (appointmentId: string) => ["consultations", "appointment", appointmentId] as const,
};

/**
 * `null` is a successful answer here, not an error, so nothing in the query
 * layer treats an unrecorded visit as a failure.
 */
export function consultationForAppointmentQueryOptions(appointmentId: string) {
  return queryOptions({
    queryKey: consultationsQueryKeys.forAppointment(appointmentId),
    queryFn: () => getConsultationForAppointment(appointmentId),
    enabled: Boolean(appointmentId),
  });
}
