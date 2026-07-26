import { Button, Center, Stack, Text, ThemeIcon } from "@mantine/core";
import Link from "next/link";

/**
 * A purposeful empty state: one line explaining what would appear here, plus
 * the primary action to create the first item where the user is allowed to
 * (UX.md → State model).
 *
 * Copy stays with the caller — bespoke empty-state wording is settled per
 * module. The primitive owns the shape, not the words.
 *
 * Gating is the caller's: pass `action` only when the user may create, or
 * wrap it in `<Can>`. Keeping the decision out of here means there is exactly
 * one gating mechanism in the codebase.
 */
export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  /** What is absent, e.g. "No patients yet". */
  title: string;
  /** One line describing what would appear here once there is something. */
  description?: string;
  icon?: React.ReactNode;
  action?: EmptyStateAction;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs" maw={420}>
        {icon && (
          <ThemeIcon variant="light" color="gray" size={48} radius="md">
            {icon}
          </ThemeIcon>
        )}

        <Text fw={500}>{title}</Text>

        {description && (
          <Text size="sm" c="dimmed" ta="center">
            {description}
          </Text>
        )}

        {action &&
          (action.href ? (
            <Button component={Link} href={action.href} mt="sm">
              {action.label}
            </Button>
          ) : (
            <Button onClick={action.onClick} mt="sm">
              {action.label}
            </Button>
          ))}
      </Stack>
    </Center>
  );
}
