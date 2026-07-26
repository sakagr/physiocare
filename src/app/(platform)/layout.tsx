import { redirect } from "next/navigation";
import { CurrentUserProvider } from "@/lib/auth/current-user-context";
import { getCurrentUser } from "@/lib/auth/current-user.server";
import { guardNamespace } from "@/lib/auth/landing";
import { PlatformShell } from "@/components/shell/platform-shell";

/**
 * The platform namespace. Same guard model as the organization group: the
 * layout resolves the caller, bounces anyone who belongs elsewhere, and
 * mounts the platform shell.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const bounceTo = guardNamespace("platform", user);

  if (bounceTo || !user) {
    redirect(bounceTo ?? "/login");
  }

  return (
    <CurrentUserProvider value={user}>
      <PlatformShell>{children}</PlatformShell>
    </CurrentUserProvider>
  );
}
