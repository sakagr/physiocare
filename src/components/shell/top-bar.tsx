"use client";

import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { IconBell } from "@tabler/icons-react";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import { UserMenu } from "./user-menu";

/**
 * The shell's top bar: working context on the left, global affordances on the
 * right (UX.md → App-shell regions).
 *
 * The desktop bar shows the working context as "Org (Clinic)". On narrow
 * widths it is dropped here and lives in the user menu instead, so it is
 * relocated rather than lost.
 */
export function TopBar({
  leading,
  currentClinicName,
  initialClinicId,
}: {
  /** Navigation controls rendered before the brand (burger, rail toggle). */
  leading?: React.ReactNode;
  currentClinicName?: string | null;
  initialClinicId?: string | null;
}) {
  const user = useCurrentUser();

  const workingContext = user.organization
    ? currentClinicName
      ? `${user.organization.name} (${currentClinicName})`
      : user.organization.name
    : null;

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        {leading}
        <Text fw={500} size="md">
          PhysioCare
        </Text>
        {workingContext && (
          <Text size="sm" c="dimmed" visibleFrom="sm" data-testid="working-context">
            {workingContext}
          </Text>
        )}
      </Group>

      <Group gap="xs" wrap="nowrap">
        {/* Notifications arrive in F9; the affordance holds its place. */}
        <Tooltip label="Notifications arrive in a later phase">
          <ActionIcon variant="subtle" color="gray" aria-label="Notifications" disabled>
            <IconBell size={20} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        <UserMenu initialClinicId={initialClinicId} />
      </Group>
    </Group>
  );
}
