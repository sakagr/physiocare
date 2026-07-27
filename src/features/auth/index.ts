/**
 * Public surface of the `auth` feature. Cross-feature imports go through this
 * barrel, never deep paths (AGENTS.md → Project Structure). Explicit named
 * exports only — never `export *`.
 *
 * Identity itself is *not* here: the current-user context lives in
 * `src/lib/auth/current-user-context.tsx`, alongside its server counterpart.
 * It is shared infrastructure that `src/components/ui` depends on, so it sits
 * below the feature layer — dependencies point down, never sideways. This
 * feature holds the auth *flows* (F1) and their queries.
 */
export { authQueryKeys, currentUserQueryOptions } from "./queries";
export {
  login,
  logout,
  requestPasswordReset,
  setPassword,
  changePassword,
  type LoginRequest,
  type ChangePasswordRequest,
} from "./api";
export {
  PASSWORD_POLICY_HINT,
  loginFormSchema,
  requestResetFormSchema,
  setPasswordFormSchema,
  changePasswordFormSchema,
  type LoginFormValues,
  type RequestResetFormValues,
  type SetPasswordFormValues,
  type ChangePasswordFormValues,
} from "./schemas";
export { LoginForm } from "./components/login-form";
export { RequestResetForm } from "./components/request-reset-form";
export { SetPasswordForm } from "./components/set-password-form";
export { ExpiredLinkState } from "./components/expired-link-state";
export { ChangePasswordDialog } from "./components/change-password-dialog";
export { MyAccountDialog } from "./components/my-account-dialog";
