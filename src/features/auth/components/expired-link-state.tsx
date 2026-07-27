import Link from "next/link";
import { Alert, Button, Stack } from "@mantine/core";
import { AuthCard } from "./auth-card";

/**
 * What a recovery or invitation link resolves to once it is spent or too old.
 *
 * It is rendered in place rather than redirected to sign-in, so the user keeps
 * the context of what they were trying to do and is offered the one action
 * that gets them out of it.
 */
export function ExpiredLinkState({
  title,
  explanation,
  actionLabel,
  actionHref,
}: {
  title: string;
  explanation: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <AuthCard title={title}>
      <Stack gap="md">
        <Alert role="status" color="warning" variant="light">
          {explanation}
        </Alert>
        <Button component={Link} href={actionHref} fullWidth>
          {actionLabel}
        </Button>
      </Stack>
    </AuthCard>
  );
}
