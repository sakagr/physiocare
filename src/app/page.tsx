import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user.server";
import { resolveLanding } from "@/lib/auth/landing";

/**
 * The landing resolver. It is not a screen: it runs after authentication and
 * sends the user to their home, which keeps sign-in role-agnostic
 * (UX.md → Landing resolution).
 */
export default async function RootPage() {
  redirect(resolveLanding(await getCurrentUser()));
}
