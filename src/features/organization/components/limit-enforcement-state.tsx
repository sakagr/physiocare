"use client";

import Link from "next/link";
import { Alert, Button, Stack, Text } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { useCan } from "@/lib/auth/current-user-context";

export type LimitEnforcementCode = "SUBSCRIPTION_REQUIRED" | "ORGANIZATION_LIMIT_EXCEEDED";

export interface LimitEnforcementStateProps {
  code: LimitEnforcementCode;
}

const OWNER_COPY: Record<LimitEnforcementCode, string> = {
  SUBSCRIPTION_REQUIRED: "Your organization doesn't have an active subscription. Select or renew a plan to continue.",
  ORGANIZATION_LIMIT_EXCEEDED: "You've reached your plan's limit. Upgrade your plan to add more.",
};

const OTHER_ROLE_COPY: Record<LimitEnforcementCode, string> = {
  SUBSCRIPTION_REQUIRED: "Your organization's subscription isn't active. Ask your owner to renew it.",
  ORGANIZATION_LIMIT_EXCEEDED: "Your organization has reached its plan's limit. Ask your owner to upgrade the subscription.",
};

/**
 * The dedicated limit/subscription enforcement state (UX.md → Error →
 * default behavior, "Limit / subscription enforcement" row; F4 M6). States
 * the limit and its resolution for the Owner/SUPER_ADMIN (`subscription:manage`
 * -- the same caller who may act on it); every other role sees a softer
 * "ask your owner" message with no dead-end action. Replaces the F3-era
 * generic 402/403 toast at exactly two call sites (create-user, create-clinic)
 * -- every other `SUBSCRIPTION_REQUIRED` site keeps the flat toast until the
 * phase that owns it adopts this component (F5-F7).
 */
export function LimitEnforcementState({ code }: LimitEnforcementStateProps) {
  const canManageSubscription = useCan("subscription:manage");
  const message = canManageSubscription ? OWNER_COPY[code] : OTHER_ROLE_COPY[code];

  return (
    <Alert color="warning" variant="light" role="alert" title="Your plan needs attention" icon={<IconLock size={18} stroke={1.5} />}>
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{message}</Text>
        {canManageSubscription && (
          <Button component={Link} href="/app/settings" size="xs" variant="default">
            Go to Settings
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
