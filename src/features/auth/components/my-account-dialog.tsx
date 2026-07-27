"use client";

import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useCurrentUser } from "@/lib/auth/current-user-context";

/**
 * My account (UX.md → Screen Inventory, contextual surfaces).
 *
 * A read-only view of who the user is signed in as, drawn from the
 * current-user contract the shell already holds. Editing a profile is a
 * separate capability and is not part of this surface; the one action here is
 * the change-password dialog, which is owned separately so it can be raised
 * from other triggers too.
 */
export function MyAccountDialog({
  opened,
  onClose,
  onChangePassword,
}: {
  opened: boolean;
  onClose: () => void;
  onChangePassword: () => void;
}) {
  const user = useCurrentUser();

  const details: [string, string][] = [
    ["Name", user.fullName],
    ["Username", user.username],
    ["Email", user.email],
    ["Phone", user.phone ?? "—"],
    ["Role", user.role.displayName],
  ];

  if (user.organization) {
    details.push(["Organization", user.organization.name]);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="My account" size="md">
      <Stack gap="lg">
        <Stack gap="xs">
          {details.map(([label, value]) => (
            <Group key={label} justify="space-between" wrap="nowrap" gap="lg">
              <Text size="sm" c="dimmed">
                {label}
              </Text>
              <Text size="sm" ta="right">
                {value}
              </Text>
            </Group>
          ))}
        </Stack>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onChangePassword}>Change password</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
