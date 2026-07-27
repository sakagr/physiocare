"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, PasswordInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/api/api-error";
import { setPassword } from "../api";
import {
  PASSWORD_POLICY_HINT,
  setPasswordFormSchema,
  type SetPasswordFormValues,
} from "../schemas";
import { AuthCard } from "./auth-card";

/**
 * Choosing a password on a recovery or invitation session — the screen both
 * flows end on, differing only in wording.
 *
 * The user reached it through a link the callback verified, so they are
 * already signed in. On success they go to the landing resolver on that same
 * session rather than being sent back to sign in again: they hold a session
 * the authentication provider itself issued, and a second sign-in would add a
 * step without adding proof.
 */
export function SetPasswordForm({
  title,
  description,
  submitLabel,
  successMessage = "Your password has been set.",
}: {
  title: string;
  description: string;
  submitLabel: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: SetPasswordFormValues) {
    setSubmitError(null);

    try {
      await setPassword(values.newPassword);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again."
      );
      return;
    }

    notifications.show({ color: "success", message: successMessage });
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard title={title} description={description}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            autoFocus
            disabled={isSubmitting}
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />

          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            disabled={isSubmitting}
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <Text size="xs" c="dimmed">
            {PASSWORD_POLICY_HINT}
          </Text>

          {submitError ? (
            <Alert role="alert" color="danger" variant="light">
              {submitError}
            </Alert>
          ) : null}

          <Button type="submit" loading={isSubmitting} fullWidth>
            {submitLabel}
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
