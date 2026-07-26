"use client";

import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, type MantineSize } from "@mantine/core";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * The create/edit shell (UX.md → Forms, Dialogs & drawers, Unsaved changes):
 * titled dialog, footer actions with the primary on the right, submit
 * progress, and the unsaved-changes guard.
 *
 * The guard has two layers, both of which UX specifies:
 *
 * 1. **In-app** — dismissing a dirty form (close button, Esc, backdrop)
 *    raises a "Discard changes?" confirm offering *Keep editing* / *Discard*.
 *    A clean form closes freely.
 * 2. **Hard browser events** — while dirty, a `beforeunload` handler
 *    backstops refresh, tab close, and browser back. Its wording is
 *    browser-controlled, so it backstops rather than replaces layer 1.
 *
 * Dirtiness is the caller's to report (react-hook-form's `formState.isDirty`),
 * because only the form knows what changed.
 */
export interface FormDialogProps {
  opened: boolean;
  /** Called once the dialog may actually close — after the guard, if any. */
  onClose: () => void;
  title: string;
  /** Wire to react-hook-form's `handleSubmit(...)`. */
  onSubmit: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  /** A value has changed from its initial state. */
  isDirty?: boolean;
  isSubmitting?: boolean;
  size?: MantineSize;
  children: React.ReactNode;
}

export function FormDialog({
  opened,
  onClose,
  title,
  onSubmit,
  submitLabel = "Save changes",
  cancelLabel = "Cancel",
  isDirty = false,
  isSubmitting = false,
  size = "md",
  children,
}: FormDialogProps) {
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);

  // Last-resort guard for events the app cannot intercept.
  useEffect(() => {
    if (!opened || !isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Assigning returnValue is what actually triggers the native prompt in
      // the browsers that still require it.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [opened, isDirty]);

  /** Every dismissal path funnels through here so none of them skips the guard. */
  function requestClose() {
    if (isDirty && !isSubmitting) {
      setDiscardPromptOpen(true);
      return;
    }
    onClose();
  }

  function discardAndClose() {
    setDiscardPromptOpen(false);
    onClose();
  }

  return (
    <>
      <Modal opened={opened} onClose={requestClose} title={title} size={size}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Stack gap="lg">
            <Stack gap="md">{children}</Stack>

            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={requestClose}
                disabled={isSubmitting}
              >
                {cancelLabel}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {submitLabel}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <ConfirmDialog
        opened={discardPromptOpen}
        onClose={() => setDiscardPromptOpen(false)}
        onConfirm={discardAndClose}
        title="Discard changes?"
        target={title}
        consequence="Your edits will be lost. This can't be undone."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
      />
    </>
  );
}
