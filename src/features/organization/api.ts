import { api } from "@/lib/api/client";
import type { Organization, OrganizationDetail } from "@/types/contracts/organization";
import type { SubscriptionPlanListResponse } from "@/types/contracts/subscription";

/** The Organization Settings & Subscription commands and reads (F4). */

export function getOrganization(id: string): Promise<OrganizationDetail> {
  return api.get<OrganizationDetail>(`/api/organizations/${id}`);
}

export interface UpdateOrganizationProfileRequest {
  organizationName?: string;
  defaultCurrencyCode?: string;
}

export function updateOrganizationProfile(id: string, input: UpdateOrganizationProfileRequest): Promise<Organization> {
  return api.patch<Organization>(`/api/organizations/${id}`, input);
}

export function listSubscriptionPlans(): Promise<SubscriptionPlanListResponse> {
  return api.get<SubscriptionPlanListResponse>("/api/subscription-plans");
}

export function selectSubscriptionPlan(organizationId: string, planName: string): Promise<Organization> {
  return api.post<Organization>(`/api/organizations/${organizationId}/subscription/select`, { planName });
}
