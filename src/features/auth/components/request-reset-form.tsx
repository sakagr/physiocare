"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Anchor, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { ApiError } from "@/lib/api/api-error";
import { requestPasswordReset } from "../api";
import {
  requestResetFormSchema,
  type RequestResetFormValues,
} from "../schemas";
import { AuthCard } from "./auth-card";

/**
 * Requesting a password-recovery link.
 *
 * The confirmation is deliberately generic and identical whatever the server
 * found, because the endpoint itself is: it never reports whether a username
 * exists. Physiotherapists and receptionists may have a placeholder email and
 * so cannot receive a link — they are steered to their administrator here, in
 * copy, rather than by a rule that would have to reveal something about the
 * account to apply it (UX.md → Flow 2).
 */
export function RequestResetForm() {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestResetFormValues>({
    resolver: zodResolver(requestResetFormSchema),
    defaultValues: { username: "" },
  });

  async function onSubmit(values: RequestResetFormValues) {
    setSubmitError(null);

    try {
      await requestPasswordReset(values.username.trim().toLowerCase());
      setSent(true);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again."
      );
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <Alert role="status" color="info" variant="light">
          If an account exists for that username, we&apos;ve sent a link to its
          email address. The link is valid for a short time.
        </Alert>
        <Text size="sm" c="dimmed">
          No email? Check the spam folder, or ask your owner or administrator to
          reset your password for you.
        </Text>
        <Group justify="center">
          <Anchor component={Link} href="/login" size="sm">
            Back to sign in
          </Anchor>
        </Group>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your username and we'll email a reset link to the address on your account."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <TextInput
            label="Username"
            autoComplete="username"
            autoFocus
            disabled={isSubmitting}
            error={errors.username?.message}
            {...register("username")}
          />

          {submitError ? (
            <Alert role="alert" color="danger" variant="light">
              {submitError}
            </Alert>
          ) : null}

          <Button type="submit" loading={isSubmitting} fullWidth>
            Send reset link
          </Button>

          <Text size="xs" c="dimmed">
            Physiotherapists and receptionists: if you don&apos;t receive an
            email, ask your owner or administrator to reset your password for
            you.
          </Text>

          <Group justify="center">
            <Anchor component={Link} href="/login" size="sm">
              Back to sign in
            </Anchor>
          </Group>
        </Stack>
      </form>
    </AuthCard>
  );
}
