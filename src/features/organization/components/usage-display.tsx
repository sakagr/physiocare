import { Group, Paper, Progress, Stack, Text, Title } from "@mantine/core";
import type { OrganizationDetail } from "@/types/contracts/organization";

type SubscriptionUsage = NonNullable<OrganizationDetail["subscription"]>["usage"];

export interface UsageDisplayProps {
  usage: SubscriptionUsage;
}

/** Plan limits & usage display (M5): clinics and users, used vs. plan max. */
export function UsageDisplay({ usage }: UsageDisplayProps) {
  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="md">
        <Title order={3} fz="h4">
          Usage
        </Title>
        <UsageRow label="Clinics" used={usage.clinics.used} max={usage.clinics.max} />
        <UsageRow label="Users" used={usage.users.used} max={usage.users.max} />
      </Stack>
    </Paper>
  );
}

function UsageRow({ label, used, max }: { label: string; used: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const nearingLimit = max > 0 && used / max >= 0.8;

  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Text size="sm">{label}</Text>
        <Text size="sm" c="dimmed">
          {used} / {max}
        </Text>
      </Group>
      <Progress value={percent} color={nearingLimit ? "warning" : "info"} size="sm" radius="xl" />
    </Stack>
  );
}
