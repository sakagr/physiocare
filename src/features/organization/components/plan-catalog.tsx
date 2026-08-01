"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Badge, Button, Card, Group, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { DataState } from "@/components/ui";
import { subscriptionPlansQueryOptions } from "../queries";
import { organizationQueryKeys } from "../queries";
import { selectSubscriptionPlan } from "../api";

export interface PlanCatalogProps {
  organizationId: string;
}

/**
 * The self-service plan catalog (M3). Only rendered while
 * subscription_status is "inactive" with no plan already selected -- see
 * `SubscriptionTab`'s state resolution. Selecting "Trial" activates
 * immediately (self-service); selecting a paid plan sets it pending
 * SUPER_ADMIN activation (the limbo state `SubscriptionTab` renders next
 * time this data refetches).
 */
export function PlanCatalog({ organizationId }: PlanCatalogProps) {
  const queryClient = useQueryClient();
  const query = useQuery(subscriptionPlansQueryOptions());

  const mutation = useMutation({
    mutationFn: (planName: string) => selectSubscriptionPlan(organizationId, planName),
    onSuccess: (_result, planName) => {
      queryClient.invalidateQueries({ queryKey: organizationQueryKeys.detail(organizationId) });
      notifications.show({
        color: "success",
        message: planName === "Trial" ? "Trial started." : `${planName} selected. Awaiting activation.`,
      });
    },
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Choose a plan to get started.
      </Text>
      <DataState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        skeleton={
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} height={160} radius="md" />
            ))}
          </SimpleGrid>
        }
      >
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {(query.data ?? []).map((plan) => (
            <Card key={plan.id} withBorder radius="md" p="lg">
              <Stack gap="xs" h="100%">
                <Group justify="space-between" align="flex-start">
                  <Text fw={600}>{plan.plan_name}</Text>
                  {plan.plan_name === "Trial" && (
                    <Badge color="info" variant="light">
                      Free
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  Up to {plan.max_clinics} clinic{plan.max_clinics === 1 ? "" : "s"}, {plan.max_users} user
                  {plan.max_users === 1 ? "" : "s"}
                </Text>
                {plan.plan_name !== "Trial" && (
                  <Text size="sm" c="dimmed">
                    ${plan.monthly_price}/mo or ${plan.yearly_price}/yr
                  </Text>
                )}
                <Button
                  mt="auto"
                  variant="default"
                  loading={mutation.isPending && mutation.variables === plan.plan_name}
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(plan.plan_name)}
                >
                  Select {plan.plan_name}
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </DataState>
    </Stack>
  );
}
