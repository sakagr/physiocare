import { queryOptions } from "@tanstack/react-query";
import { listPrescriptions } from "./api";

export const prescriptionsQueryKeys = {
  all: ["prescriptions"] as const,
  forConsultation: (consultationId: string) => ["prescriptions", "consultation", consultationId] as const,
};

export function prescriptionsQueryOptions(consultationId: string) {
  return queryOptions({
    queryKey: prescriptionsQueryKeys.forConsultation(consultationId),
    queryFn: () => listPrescriptions(consultationId),
    enabled: Boolean(consultationId),
  });
}
