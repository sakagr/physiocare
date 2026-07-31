"use client";

import { useState } from "react";
import { Alert, Button, CopyButton, Group, PasswordInput, Stack } from "@mantine/core";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * A secret shown exactly once, then never again (F3, first use: the
 * system-generated initial password). Domain-blind by design — it displays
 * *a secret*, not *a password*; the two consumers (create-user success state,
 * admin-mediated reset) supply the domain-specific copy.
 *
 * Masked by default via `PasswordInput`'s own reveal toggle, with a
 * `CopyButton` alongside it (both already installed -- `@mantine/core`, no
 * new dependency, AGENTS.md -> Scope Control). Dismissal is unrecoverable and
 * routes through `ConfirmDialog`, which already requires naming the
 * consequence -- there is no way to close this surface without
 * acknowledging the value is gone for good.
 *
 * The caller must call `mutation.reset()` (or equivalent) from `onDismiss`
 * so the secret does not linger in memory after dismissal. This component
 * never persists `value` anywhere -- not the query cache, a cookie, nor
 * `localStorage`.
 */
export interface RevealOnceProps {
  /** What the secret is, e.g. "Initial password". */
  label: string;
  /** The secret itself. Held in memory only. */
  value: string;
  /** Why it can't be retrieved again, shown alongside the value. */
  warning: string;
  /** The effect of dismissing, named in the confirm (ConfirmDialog's `consequence`). */
  dismissConsequence: string;
  onDismiss: () => void;
}

export function RevealOnce({
  label,
  value,
  warning,
  dismissConsequence,
  onDismiss,
}: RevealOnceProps) {
  const [confirmOpened, setConfirmOpened] = useState(false);

  return (
    <Stack gap="md">
      <PasswordInput label={label} value={value} readOnly />

      <CopyButton value={value}>
        {({ copied, copy }) => (
          <Button variant="default" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </CopyButton>

      <Alert color="warning" variant="light">
        {warning}
      </Alert>

      <Group justify="flex-end">
        <Button onClick={() => setConfirmOpened(true)}>Done</Button>
      </Group>

      <ConfirmDialog
        opened={confirmOpened}
        onClose={() => setConfirmOpened(false)}
        onConfirm={() => {
          setConfirmOpened(false);
          onDismiss();
        }}
        title={`Done with ${label.toLowerCase()}?`}
        target={label}
        consequence={dismissConsequence}
        confirmLabel="I've saved it"
        danger={false}
      />
    </Stack>
  );
}
