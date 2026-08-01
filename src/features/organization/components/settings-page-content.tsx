"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton, Stack, Tabs } from "@mantine/core";
import { DataState, PageHeader } from "@/components/ui";
import { useCan, useCurrentUser } from "@/lib/auth/current-user-context";
import { organizationDetailQueryOptions } from "../queries";
import { OrganizationTab } from "./organization-tab";
import { SubscriptionTab } from "./subscription-tab";

/**
 * Settings destination (F4): Organization tab (profile, M1/M0-B) and,
 * Owner/SUPER_ADMIN only, a Subscription tab (M2-M5). The page-level
 * `Can capability="settings:manage"` gate (see `page.tsx`) lets ORG_ADMIN
 * reach this destination at all; the Subscription tab itself gates further
 * on `subscription:manage`, matching `organizationDetailSchema`'s
 * server-side projection (`subscription: null` for a caller without it).
 */
export function SettingsPageContent() {
  const user = useCurrentUser();
  const canManageSubscription = useCan("subscription:manage");
  const organizationId = user.organization?.id;
  const query = useQuery({
    ...organizationDetailQueryOptions(organizationId ?? ""),
    enabled: Boolean(organizationId),
  });

  return (
    <>
      <PageHeader title="Settings" description="Your organization profile and subscription." />

      <DataState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        skeleton={
          <Stack gap="md">
            <Skeleton height={200} radius="md" />
          </Stack>
        }
      >
        {query.data && (
          <Tabs defaultValue="organization">
            <Tabs.List>
              <Tabs.Tab value="organization">Organization</Tabs.Tab>
              {canManageSubscription && <Tabs.Tab value="subscription">Subscription</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="organization" pt="md">
              <OrganizationTab organization={query.data} />
            </Tabs.Panel>

            {canManageSubscription && (
              <Tabs.Panel value="subscription" pt="md">
                <SubscriptionTab organization={query.data} />
              </Tabs.Panel>
            )}
          </Tabs>
        )}
      </DataState>
    </>
  );
}
