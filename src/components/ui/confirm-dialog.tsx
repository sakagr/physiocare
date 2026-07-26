"use client";

import { Button, Group, Modal, Stack, Text } from "@mantine/core";

/**
 * Destructive confirmation (UX.md → Destructive & irreversible actions).
 *
 * `target`, `consequence`, and `confirmLabel` are **required**, and that is
 * the design: it is not possible to render "Are you sure? / OK" through this
 * component. The convention — name the specific target and the effect, and
 * put the action's verb on the confirm button — is enforced by the type
 * signature rather than by a guideline someone has to remember.
 *
 * Undo is deliberately not here. Where a soft delete offers it, it belongs on
 * the success toast the caller fires, not on the confirmation.
 *
 * Layering: this may open above a `FormDialog` (dialog over dialog) — that is
 * the same task's guard. A *drawer* over a dialog is what UX prohibits.
 */
export interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Question form, e.g. "Deactivate user?". */
  title: string;
  /** The specific thing being acted on, e.g. "Dr. Menon". */
  target: string;
  /** What happens as a result, e.g. "They lose access until reactivated." */
  consequence: string;
  /** The action's verb, e.g. "Deactivate" — never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Danger styling; on by default because that is what this dialog is for. */
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  target,
  consequence,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text fw={500}>{target}</Text>
          <Text size="sm" c="dimmed">
            {consequence}
          </Text>
        </Stack>

        {/* Primary on the right, separated from the cancel affordance so a
            destructive action is not triggered by muscle memory. */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            color={danger ? "danger" : undefined}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
