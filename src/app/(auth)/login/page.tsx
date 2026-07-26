"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

import { createClient } from "@/lib/supabase/client";

function getSafeRedirectPath(next: string | null) {
  // Falls through to the landing resolver, which picks the namespace.
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setPassword("");
        setError(signInError.message);
        return;
      }

      router.push(getSafeRedirectPath(searchParams.get("next")));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper w="100%" maw={400} p="xl" radius="md" withBorder bg="white">
      <Title order={1}>Sign in</Title>
      <Text size="sm" c="dimmed" mt={4}>
        Enter your email and password to continue.
      </Text>

      <form
        onSubmit={handleSubmit}
        aria-describedby={error ? "login-error" : undefined}
      >
        <Stack gap="md" mt="lg">
          <TextInput
            id="email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            disabled={loading}
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />

          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            disabled={loading}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          {error ? (
            <Alert id="login-error" role="alert" color="danger" variant="light">
              {error}
            </Alert>
          ) : null}

          <Button type="submit" loading={loading} fullWidth mt="xs">
            Sign in
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Text size="sm" c="dimmed">Loading…</Text>}>
      <LoginForm />
    </Suspense>
  );
}
