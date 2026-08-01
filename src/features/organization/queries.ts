import { queryOptions } from "@tanstack/react-query";
import { getOrganization, listSubscriptionPlans } from "./api";

export const organizationQueryKeys = {
  detail: (id: string) => ["organization", "detail", id] as const,
  plans: () => ["organization", "subscription-plans"] as const,
};

export function organizationDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: organizationQueryKeys.detail(id),
    queryFn: () => getOrganization(id),
    enabled: Boolean(id),
  });
}

export function subscriptionPlansQueryOptions() {
  return queryOptions({
    queryKey: organizationQueryKeys.plans(),
    queryFn: () => listSubscriptionPlans(),
  });
}
