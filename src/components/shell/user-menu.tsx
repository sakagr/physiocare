"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Box,
  Divider,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconLock,
  IconLogout,
  IconUser,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import { ClinicSwitcher } from "./clinic-switcher";

/**
 * The user menu, identical on every device (UX.md → Working context & user
 * menu): the user's name and role, the organization as a label, the clinic
 * dropdown, then account actions and Log out.
 *
 * On narrow widths the top bar drops the working context, so the
 * organization and clinic shown here are the only place it appears — it is
 * never dropped, only relocated.
 */
export function UserMenu({ initialClinicId }: { initialClinicId?: string | null }) {
  const user = useCurrentUser();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Menu position="bottom-end" width={260} closeOnItemClick>
      <Menu.Target>
        <UnstyledButton aria-label="Open user menu">
          <Group gap="xs" wrap="nowrap">
            <Avatar color="teal" radius="xl" size={32}>
              {initials}
            </Avatar>
            <Box visibleFrom="sm">
              <Text size="sm" fw={500} lh={1.2}>
                {user.fullName}
              </Text>
              <Text size="xs" c="dimmed" lh={1.2}>
                {user.role.displayName}
              </Text>
            </Box>
            <IconChevronDown size={16} stroke={1.5} />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Box px="sm" py="xs">
          <Text size="sm" fw={500}>
            {user.fullName}
          </Text>
          <Text size="xs" c="dimmed">
            {user.role.displayName}
          </Text>
          {user.organization && (
            <Text size="xs" c="dimmed" mt={4}>
              {user.organization.name}
            </Text>
          )}
        </Box>

        {user.clinics.length > 0 && (
          <>
            <Divider />
            <Box px="sm" py="xs" onClick={(event) => event.stopPropagation()}>
              <ClinicSwitcher
                clinics={user.clinics}
                initialClinicId={initialClinicId}
              />
            </Box>
          </>
        )}

        <Divider />
        {/* Account surfaces are F1 destinations; shown but inert until then. */}
        <Menu.Item leftSection={<IconUser size={16} stroke={1.5} />} disabled>
          My account
        </Menu.Item>
        <Menu.Item leftSection={<IconLock size={16} stroke={1.5} />} disabled>
          Change password
        </Menu.Item>

        <Divider />
        <Menu.Item
          leftSection={<IconLogout size={16} stroke={1.5} />}
          onClick={handleLogout}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Log out"}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
