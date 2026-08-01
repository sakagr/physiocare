"use client";

import { Button, Group, Paper, Stack, Text, Title, Tooltip } from "@mantine/core";

/**
 * The Subscription Activation & Renewal surface (M4, decision 1). Always
 * rendered, real and routed -- never hidden or stubbed -- but permanently
 * disabled: no self-service activation/renewal exists yet (SUPER_ADMIN only,
 * manual-ops). The copy names why and where instead, per the "named
 * consequence, never a dead end" convention `ForbiddenState` already
 * encodes. No capability gate here -- this is a product-state display, not
 * a permission boundary.
 */
export function ActivationRenewalSection() {
  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="sm">
        <Title order={3} fz="h4">
          Activation & renewal
        </Title>
        <Text size="sm" c="dimmed">
          Self-service activation and renewal aren&apos;t available yet. Contact platform support to activate a paid
          plan or renew your subscription.
        </Text>
        <Group>
          <Tooltip label="Not available yet -- contact platform support">
            <Button variant="default" disabled aria-disabled="true">
              Activate
            </Button>
          </Tooltip>
          <Tooltip label="Not available yet -- contact platform support">
            <Button variant="default" disabled aria-disabled="true">
              Renew
            </Button>
          </Tooltip>
        </Group>
      </Stack>
    </Paper>
  );
}
