import { cookies } from "next/headers";
import {
  PASSWORD_SETUP_COOKIE,
  isPasswordSetupFlow,
} from "@/lib/auth/password-setup-ticket";
import { ExpiredLinkState, SetPasswordForm } from "@/features/auth";

/**
 * Invitation acceptance: an invited user chooses the password their account
 * has never had (UX.md → Flow 3).
 *
 * Like the recovery confirm screen, it is reached only through
 * `/auth/callback`, which has already exchanged the invitation token for a
 * session and left the password-setup ticket behind.
 */
export default async function InvitePage() {
  const ticket = (await cookies()).get(PASSWORD_SETUP_COOKIE)?.value;

  if (!isPasswordSetupFlow(ticket)) {
    return (
      <ExpiredLinkState
        title="This invitation has expired"
        explanation="Invitation links can only be used once, and expire after a while. Ask your administrator to send a new one."
        actionLabel="Back to sign in"
        actionHref="/login"
      />
    );
  }

  return (
    <SetPasswordForm
      title="Set your password"
      description="Choose a password to finish setting up your account."
      submitLabel="Set password"
      successMessage="Your account is ready."
    />
  );
}
