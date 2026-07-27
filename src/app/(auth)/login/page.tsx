import { Suspense } from "react";
import { Text } from "@mantine/core";
import { LoginForm } from "@/features/auth";

/**
 * The shared front door. Every role signs in here; the landing resolver
 * decides where they go afterwards, so this page knows nothing about roles
 * (UX.md → Flow 1).
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
