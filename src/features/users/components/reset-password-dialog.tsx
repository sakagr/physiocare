"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Modal } from "@mantine/core";
import { ConfirmDialog, RevealOnce } from "@/components/ui";
import { resetUserPassword } from "../api";

/**
 * Admin-mediated password reset (UX.md → Flow 9 step 4, Hole B): a
 * destructive-adjacent confirm (their current password stops working
 * immediately), then the reveal-once success state for the new one. The
 * only recovery path for roles with a placeholder email.
 */
export interface ResetPasswordDialogProps {
  opened: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function ResetPasswordDialog({ opened, onClose, userId, userName }: ResetPasswordDialogProps) {
  const mutation = useMutation({
    mutationFn: () => resetUserPassword(userId),
  });

  useEffect(() => {
    if (opened) {
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  function dismissReveal() {
    notifications.show({ color: "success", message: `${userName}'s password was reset.` });
    mutation.reset();
    onClose();
  }

  if (mutation.isSuccess) {
    return (
      <Modal
        opened={opened}
        onClose={() => {}}
        title="Password reset"
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <RevealOnce
          label="New password"
          value={mutation.data.initialPassword}
          warning={`This is the only time ${userName}'s new password will be shown. Share it securely -- if lost, it must be reset again.`}
          dismissConsequence="You won't be able to see this password again."
          onDismiss={dismissReveal}
        />
      </Modal>
    );
  }

  return (
    <ConfirmDialog
      opened={opened}
      onClose={onClose}
      onConfirm={() => mutation.mutate()}
      title="Reset password?"
      target={userName}
      consequence="Their current password stops working immediately. Share the new one with them securely."
      confirmLabel="Reset password"
      danger={false}
      loading={mutation.isPending}
    />
  );
}
