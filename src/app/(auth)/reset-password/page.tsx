import { RequestResetForm } from "@/features/auth";

/**
 * Requesting a password-recovery link. The confirm step lives at
 * `/reset-password/confirm`, which the emailed link reaches through
 * `/auth/callback` (UX.md → Flow 2).
 */
export default function ResetPasswordPage() {
  return <RequestResetForm />;
}
