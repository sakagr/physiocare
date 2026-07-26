import Link from "next/link";
import { Affix, Anchor, Box, Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";

/**
 * The frame every destination shares (UX.md → Page structure): the title, one
 * optional line of context, and **at most one** primary action — the type
 * allows a single `primaryAction`, so "two primary buttons" is not expressible.
 *
 * A nested destination shows its parent and a return path, so a patient
 * workspace reached from Patients always offers the way back.
 *
 * On narrow widths the primary action relocates to a floating action button
 * so it stays reachable one-handed while scrolling. Both renderings are in
 * the DOM and the viewport decides which is visible — the accessible name is
 * identical, so assistive technology sees one action either way.
 *
 * Capability gating is the caller's: omit `primaryAction`, or wrap secondary
 * actions in `<Can>`. Keeping it out means one gating mechanism, not two.
 */
export interface PageHeaderAction {
  /** Names the action, e.g. "New patient" — never "Add" alone. */
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

export interface PageHeaderProps {
  title: string;
  /** One line of context beneath the title. */
  description?: string;
  /** Parent destination and return path, for a nested destination. */
  parent?: { label: string; href: string };
  primaryAction?: PageHeaderAction;
  /** Secondary actions, tabs, or filters belonging to the header. */
  children?: React.ReactNode;
}

function ActionButton({
  action,
  ...props
}: { action: PageHeaderAction } & Record<string, unknown>) {
  const shared = {
    leftSection: action.icon,
    disabled: action.disabled,
    loading: action.loading,
    ...props,
  };

  return action.href ? (
    <Button component={Link} href={action.href} {...shared}>
      {action.label}
    </Button>
  ) : (
    <Button onClick={action.onClick} {...shared}>
      {action.label}
    </Button>
  );
}

export function PageHeader({
  title,
  description,
  parent,
  primaryAction,
  children,
}: PageHeaderProps) {
  return (
    <Box component="header" mb="lg">
      {parent && (
        <Anchor
          component={Link}
          href={parent.href}
          size="sm"
          c="dimmed"
          mb="xs"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <IconChevronLeft size={14} stroke={1.5} />
          {parent.label}
        </Anchor>
      )}

      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Stack gap={2}>
          <Title order={1}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>

        <Group gap="sm" wrap="nowrap">
          {children}
          {primaryAction && (
            <Box visibleFrom="sm">
              <ActionButton action={primaryAction} />
            </Box>
          )}
        </Group>
      </Group>

      {/* Narrow widths: the same action, reachable one-handed while scrolling.
          Collections leave bottom padding so it never covers the last item. */}
      {primaryAction && (
        <Affix position={{ bottom: 24, right: 24 }} hiddenFrom="sm">
          <ActionButton action={primaryAction} radius="xl" size="md" />
        </Affix>
      )}
    </Box>
  );
}
