import { cookies } from "next/headers";
import {
  PASSWORD_SETUP_COOKIE,
  isPasswordSetupFlow,
} from "@/lib/auth/password-setup-ticket";
import { ExpiredLinkState, SetPasswordForm } from "@/features/auth";

/**
 * Setting a new password after following a recovery link.
 *
 * `/auth/callback` has already exchanged the emailed token for a session and
 * left the password-setup ticket behind, so no token appears in this URL. The
 * ticket's absence is what an expired or already-used link looks like here.
 */
export default async function ResetPasswordConfirmPage() {
  const ticket = (await cookies()).get(PASSWORD_SETUP_COOKIE)?.value;

  if (!isPasswordSetupFlow(ticket)) {
    return (
      <ExpiredLinkState
        title="This link has expired"
        explanation="Password reset links can only be used once, and expire shortly after they are sent."
        actionLabel="Request a new link"
        actionHref="/reset-password"
      />
    );
  }

  return (
    <SetPasswordForm
      title="Choose a new password"
      description="Pick a password you haven't used here before."
      submitLabel="Save new password"
      successMessage="Your password has been updated."
    />
  );
}
