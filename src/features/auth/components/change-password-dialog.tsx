"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { PasswordInput, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { FormDialog } from "@/components/ui";
import { ApiError } from "@/lib/api/api-error";
import type { ErrorCode } from "@/server/errors";
import { changePassword } from "../api";
import {
  PASSWORD_POLICY_HINT,
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from "../schemas";

/**
 * Changing a known password (UX.md → Change-password dialog).
 *
 * Reusable and decoupled from My Account so the same content can be raised
 * from several triggers. `required` is the seam for the forced modes UX
 * describes (first login, expiry): it removes every way out of the dialog.
 * Only the voluntary mode is wired today.
 *
 * Unlike sign-in, this runs on an authenticated surface, so it goes through
 * `useMutation` and the shared error pipeline — here a 401 really does mean
 * the session died and a bounce to sign-in is correct. A wrong current
 * password is a 400 precisely so it lands on the field instead.
 */
/**
 * Typed as `ErrorCode` so a rename on the backend fails this file at compile
 * time, without importing server runtime code into a client component.
 */
const INVALID_CURRENT_PASSWORD: ErrorCode = "INVALID_CURRENT_PASSWORD";

export function ChangePasswordDialog({
  opened,
  onClose,
  required = false,
}: {
  opened: boolean;
  onClose: () => void;
  required?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  // Each opening starts clean; a half-typed password must never be waiting
  // for whoever opens the dialog next.
  useEffect(() => {
    if (opened) {
      reset();
    }
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      notifications.show({
        color: "success",
        message: "Your password has been changed.",
      });
      reset();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === INVALID_CURRENT_PASSWORD) {
        setError("currentPassword", { message: error.message });
        setFocus("currentPassword");
      }
    },
  });

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title="Change password"
      submitLabel="Change password"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
      dismissible={!required}
    >
      <PasswordInput
        label="Current password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />

      <PasswordInput
        label="New password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />

      <PasswordInput
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <Text size="xs" c="dimmed">
        {PASSWORD_POLICY_HINT}
      </Text>
    </FormDialog>
  );
}
