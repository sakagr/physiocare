import { Paper, Stack, Text, Title } from "@mantine/core";

/**
 * The frame every front-door screen shares: a single centered card on the
 * plain `(auth)` background, with the destination's title and one line of
 * context above its content (UX.md → App-shell regions, Page structure).
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Paper w="100%" maw={420} p="xl" radius="md" withBorder bg="white">
      <Title order={1} fz="h2">
        {title}
      </Title>
      {description ? (
        <Text size="sm" c="dimmed" mt={4}>
          {description}
        </Text>
      ) : null}

      <Stack gap="md" mt="lg">
        {children}
      </Stack>
    </Paper>
  );
}
