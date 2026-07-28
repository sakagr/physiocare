"use client";

import Link from "next/link";
import { Button, Center, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";

/**
 * The forbidden frame (UX.md → Error → default behavior).
 *
 * Reaching it should be rare: actions a user lacks capability for are hidden
 * or disabled rather than shown and then failing, so this is the safety net
 * behind that gating — a 403 the client could not anticipate, or a surface
 * reached by a stale link.
 *
 * A way back is required, not optional: the whole point of the frame is that
 * it is not a dead end.
 *
 * Client Component, not merely because Mantine's primitives already are one:
 * `<Button component={Link}>` passes the `Link` reference as a plain prop
 * value, and React can only serialize a Client Component reference used as
 * a prop across the Server→Client boundary when the element containing it
 * is itself rendered client-side. Rendered from a Server Component (as this
 * was from `platform/admin/page.tsx`), the same JSX throws "Functions cannot
 * be passed directly to Client Components".
 */
export interface ForbiddenStateProps {
  /** What was refused, in the user's terms. */
  title?: string;
  /** One line on what to do about it. */
  description?: string;
  backHref: string;
  backLabel: string;
}

export function ForbiddenState({
  title = "You don't have permission to view this",
  description = "If you think you should have access, ask your owner or administrator.",
  backHref,
  backLabel,
}: ForbiddenStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs" maw={420}>
        <ThemeIcon variant="light" color="gray" size={48} radius="md">
          <IconLock size={24} stroke={1.5} />
        </ThemeIcon>

        <Title order={2} fz="h3" ta="center">
          {title}
        </Title>

        <Text size="sm" c="dimmed" ta="center">
          {description}
        </Text>

        <Button component={Link} href={backHref} mt="sm" variant="default">
          {backLabel}
        </Button>
      </Stack>
    </Center>
  );
}
