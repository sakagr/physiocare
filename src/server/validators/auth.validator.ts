import { z } from "zod";

/**
 * Validation for the authentication workflows: sign-in, password recovery,
 * and password changes.
 */

/**
 * The login identifier. Usernames are stored lowercase and normalized by the
 * validation layer before use (AGENTS.md → Username).
 */
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: "Enter your username." });

/**
 * A password the user chooses for themselves (AGENTS.md → User-Defined
 * Password). Deliberately not applied to sign-in: accounts created with a
 * system-generated password must keep working, and enforcing the policy at
 * the front door would disclose it to anyone probing.
 */
export const userDefinedPasswordSchema = z
  .string()
  .min(8, { message: "Use at least 8 characters." })
  .regex(/[a-z]/, { message: "Include a lowercase letter." })
  .regex(/[A-Z]/, { message: "Include an uppercase letter." })
  .regex(/[0-9]/, { message: "Include a number." })
  .regex(/[^a-zA-Z0-9]/, { message: "Include a special character." });

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, { message: "Enter your password." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export function validateLoginInput(input: unknown): LoginInput {
  return loginSchema.parse(input);
}

export const requestPasswordResetSchema = z.object({
  username: usernameSchema,
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export function validateRequestPasswordResetInput(
  input: unknown
): RequestPasswordResetInput {
  return requestPasswordResetSchema.parse(input);
}

/** Setting a password on a recovery or invitation session. */
export const setPasswordSchema = z.object({
  newPassword: userDefinedPasswordSchema,
});

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export function validateSetPasswordInput(input: unknown): SetPasswordInput {
  return setPasswordSchema.parse(input);
}

/** Voluntarily changing a known password. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Enter your current password." }),
    newPassword: userDefinedPasswordSchema,
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Choose a password you haven't used here before.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export function validateChangePasswordInput(input: unknown): ChangePasswordInput {
  return changePasswordSchema.parse(input);
}
