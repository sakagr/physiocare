"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Anchor,
  Button,
  Group,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { ApiError } from "@/lib/api/api-error";
import { login } from "../api";
import { loginFormSchema, type LoginFormValues } from "../schemas";
import { AuthCard } from "./auth-card";

/**
 * The single front door for every role. Username — never email — is the login
 * identifier; the email behind it is an implementation detail the server
 * resolves (AGENTS.md → Authentication).
 *
 * The submission deliberately does **not** go through TanStack Query. A
 * failed sign-in is a 401, and the shared cache-level handler treats a 401 as
 * a dead session and leaves for the login page — which is where the user
 * already is. Calling the API directly here keeps a wrong password an inline
 * message on the form it happened on.
 */

/** Falls through to the landing resolver, which picks the namespace. */
function getSafeReturnPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

/** The callback's failure codes, as copy a clinic user can act on. */
const LINK_ERRORS: Record<string, string> = {
  auth_callback_missing_params:
    "That link was incomplete. Request a new one and try again.",
  auth_callback_exchange_failed:
    "That link has expired or was already used. Request a new one.",
  auth_callback_verify_failed:
    "That link has expired or was already used. Request a new one.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { username: "", password: "" },
  });

  const sessionExpired = searchParams.get("reason") === "expired";
  const linkError = LINK_ERRORS[searchParams.get("error") ?? ""] ?? null;

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);

    try {
      await login({
        username: values.username.trim().toLowerCase(),
        password: values.password,
      });
    } catch (error) {
      // A retry should start from a known state rather than from a password
      // the user cannot see.
      setValue("password", "");
      setFocus("password");
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again."
      );
      return;
    }

    router.push(getSafeReturnPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <AuthCard title="Sign in" description="Use your username and password to continue.">
      {sessionExpired ? (
        <Alert role="status" color="info" variant="light">
          Your session expired. Sign in again to continue where you left off.
        </Alert>
      ) : null}

      {linkError ? (
        <Alert role="alert" color="warning" variant="light">
          {linkError}
        </Alert>
      ) : null}

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

          <PasswordInput
            label="Password"
            autoComplete="current-password"
            disabled={isSubmitting}
            error={errors.password?.message}
            {...register("password")}
          />

          {submitError ? (
            <Alert role="alert" color="danger" variant="light">
              {submitError}
            </Alert>
          ) : null}

          <Button type="submit" loading={isSubmitting} fullWidth>
            Sign in
          </Button>

          <Group justify="center">
            <Anchor component={Link} href="/reset-password" size="sm">
              Forgot your password?
            </Anchor>
          </Group>
        </Stack>
      </form>
    </AuthCard>
  );
}
