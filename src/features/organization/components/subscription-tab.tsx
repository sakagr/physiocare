import { Paper, Stack, Text, Title } from "@mantine/core";
import { StatusBadge } from "@/components/ui";
import type { SemanticRole } from "@/lib/theme";
import type { OrganizationDetail } from "@/types/contracts/organization";
import { PlanCatalog } from "./plan-catalog";
import { ActivationRenewalSection } from "./activation-renewal-section";
import { UsageDisplay } from "./usage-display";

export interface SubscriptionTabProps {
  organization: OrganizationDetail;
}

const STATUS_LABEL: Record<string, string> = {
  inactive: "Inactive",
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  cancelled: "Cancelled",
  expired: "Expired",
};

const STATUS_ROLE: Record<string, SemanticRole> = {
  inactive: "neutral",
  trialing: "info",
  active: "success",
  past_due: "warning",
  cancelled: "danger",
  expired: "danger",
};

/**
 * Subscription tab: only rendered for a caller `SubscriptionTab`'s parent
 * gates on (`subscription:manage`) -- `organization.subscription` is
 * therefore always populated here, never null (the API's projection for a
 * caller without that capability, which never reaches this component).
 */
export function SubscriptionTab({ organization }: SubscriptionTabProps) {
  const subscription = organization.subscription;
  if (!subscription) {
    return null;
  }

  const isNoPlanSelected = subscription.planName === "NO_SUBSCRIPTION" && subscription.status === "inactive";
  const isPendingActivation = subscription.status === "inactive" && !isNoPlanSelected;

  return (
    <Stack gap="md">
      {isNoPlanSelected ? (
        <PlanCatalog organizationId={organization.id} />
      ) : (
        <Paper withBorder p="lg" radius="md">
          <Stack gap="sm">
            <Title order={3} fz="h4">
              Current plan
            </Title>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Plan
              </Text>
              <Text>{subscription.planName}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Status
              </Text>
              <StatusBadge role={STATUS_ROLE[subscription.status] ?? "neutral"} label={STATUS_LABEL[subscription.status] ?? subscription.status} />
            </Stack>
            {isPendingActivation && (
              <Text size="sm" c="dimmed">
                Plan selected -- awaiting activation. Contact platform support to complete setup.
              </Text>
            )}
            {subscription.startsAt && (
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Started
                </Text>
                <Text>{new Date(subscription.startsAt).toLocaleDateString()}</Text>
              </Stack>
            )}
            {subscription.endsAt && (
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {subscription.status === "trialing" ? "Trial ends" : "Renews / ends"}
                </Text>
                <Text>{new Date(subscription.endsAt).toLocaleDateString()}</Text>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      <UsageDisplay usage={subscription.usage} />

      <ActivationRenewalSection />
    </Stack>
  );
}
