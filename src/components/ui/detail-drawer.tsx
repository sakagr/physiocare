"use client";

import { Box, Divider, Drawer, Group, Stack, Text } from "@mantine/core";

/**
 * Entity detail that keeps its list in view (UX.md → Dialogs & drawers):
 * slides from the right over the content region, with a consistent header and
 * close affordance, so the user never loses the collection they came from.
 *
 * Focus is trapped while open and returned to the trigger on close (Mantine),
 * and Esc closes — both asserted in the component test rather than assumed.
 *
 * **Layering invariant: never open a drawer over a dialog.** A drawer is a
 * peek beside its list, so a dialog above it has nowhere coherent to return
 * to. This is a documented rule rather than an enforced one — enforcing it
 * would mean shared mutable overlay state across primitives, which costs more
 * than the mistake it prevents. Recorded in AGENTS.md → ADR-0006.
 */
export interface DetailDrawerProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  /** One line of context under the title, e.g. the entity's status or code. */
  subtitle?: string;
  /** Actions pinned below the content. */
  footer?: React.ReactNode;
  size?: string | number;
  children: React.ReactNode;
}

export function DetailDrawer({
  opened,
  onClose,
  title,
  subtitle,
  footer,
  size = "md",
  children,
}: DetailDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      size={size}
      // Mantine's close button ships without an accessible name; a drawer
      // whose only dismissal is an unnamed icon fails keyboard/AT users.
      closeButtonProps={{ "aria-label": "Close" }}
      // Focus returns to the trigger on close (UX.md → Accessibility).
      returnFocus
      styles={{ content: { display: "flex", flexDirection: "column" } }}
      title={
        <Box>
          <Text fw={500}>{title}</Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Box>
      }
    >
      <Stack gap="md" style={{ flex: 1 }}>
        <Box style={{ flex: 1 }}>{children}</Box>

        {footer && (
          <>
            <Divider />
            <Group justify="flex-end" gap="sm">
              {footer}
            </Group>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
