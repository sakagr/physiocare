import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CurrentUserProvider } from "@/lib/auth/current-user-context";
import { getCurrentUser } from "@/lib/auth/current-user.server";
import { guardNamespace } from "@/lib/auth/landing";
import { OrgShell } from "@/components/shell/org-shell";
import {
  CURRENT_CLINIC_COOKIE,
  NAV_COLLAPSED_COOKIE,
} from "@/components/shell/shell-preferences";

/**
 * The organization namespace. This layout is the only gate: it resolves the
 * caller server-side, bounces anyone who does not belong to this namespace,
 * and mounts the shell for everyone who does. Pages beneath it never repeat
 * the check (AGENTS.md → Project Structure).
 *
 * It also seeds the current-user context with the identity it already
 * fetched, so the shell renders capability-filtered navigation without a
 * second round-trip.
 */
export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const bounceTo = guardNamespace("org", user);

  if (bounceTo || !user) {
    redirect(bounceTo ?? "/login");
  }

  // Shell preferences are read during the server render so the shell paints
  // in the state the user left it in, with no post-hydration correction.
  const cookieStore = await cookies();
  const navCollapsed =
    cookieStore.get(NAV_COLLAPSED_COOKIE)?.value === "true";
  const currentClinicId = cookieStore.get(CURRENT_CLINIC_COOKIE)?.value ?? null;

  return (
    <CurrentUserProvider value={user}>
      <OrgShell
        initialNavCollapsed={navCollapsed}
        initialClinicId={currentClinicId}
      >
        {children}
      </OrgShell>
    </CurrentUserProvider>
  );
}
