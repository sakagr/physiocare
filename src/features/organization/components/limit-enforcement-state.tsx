"use client";

import Link from "next/link";
import { Alert, Button, Stack, Text } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { useCan } from "@/lib/auth/current-user-context";
import { ApiError } from "@/lib/api/api-error";

export type LimitEnforcementCode = "SUBSCRIPTION_REQUIRED" | "ORGANIZATION_LIMIT_EXCEEDED";

/**
 * The codes a form dialog suppresses from the global toast so it can render
 * this state inline instead. Lives here rather than being redeclared at each
 * dialog: the list and the component's copy map must stay in step, and a
 * dialog that suppresses a code with no copy would render nothing at all.
 */
export const LIMIT_ENFORCEMENT_CODES: LimitEnforcementCode[] = [
  "SUBSCRIPTION_REQUIRED",
  "ORGANIZATION_LIMIT_EXCEEDED",
];

/** Narrows a thrown value to a limit-enforcement code, or null. */
export function limitEnforcementCode(error: unknown): LimitEnforcementCode | null {
  if (error instanceof ApiError && error.code && (LIMIT_ENFORCEMENT_CODES as string[]).includes(error.code)) {
    return error.code as LimitEnforcementCode;
  }
  return null;
}

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
 * "ask your owner" message with no dead-end action.
 *
 * Where it belongs is a rule, not a list (UX.md -> Error -> default
 * behavior): **a form dialog over a gated write renders this state; a
 * confirmation dialog or an inline row action renders the flat toast.** The
 * distinction is whether the surface stays open long enough to host a
 * persistent, role-aware message -- a form dialog keeps the user's input, a
 * confirm closes on its own. It applies to edits as much as creates.
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
