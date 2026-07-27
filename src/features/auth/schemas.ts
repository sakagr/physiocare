import { z } from "zod";

/**
 * Client form schemas for the authentication flows. Feature-owned and
 * separate from the server validators, tailored for form UX — they carry
 * UI-only fields (password confirmation) and the copy the user reads
 * (AGENTS.md → Forms and Validation). The server validators remain the
 * authoritative runtime validation; these are advisory.
 */

/**
 * The user-defined password policy, stated as one message per rule so the
 * form can tell the user which requirement is missing rather than repeating
 * the whole policy at them.
 */
export const passwordSchema = z
  .string()
  .min(8, { message: "Use at least 8 characters." })
  .regex(/[a-z]/, { message: "Include a lowercase letter." })
  .regex(/[A-Z]/, { message: "Include an uppercase letter." })
  .regex(/[0-9]/, { message: "Include a number." })
  .regex(/[^a-zA-Z0-9]/, { message: "Include a special character." });

/** Human-readable statement of the same policy, shown before the user trips it. */
export const PASSWORD_POLICY_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character.";

export const loginFormSchema = z.object({
  username: z.string().trim().min(1, { message: "Enter your username." }),
  password: z.string().min(1, { message: "Enter your password." }),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const requestResetFormSchema = z.object({
  username: z.string().trim().min(1, { message: "Enter your username." }),
});

export type RequestResetFormValues = z.infer<typeof requestResetFormSchema>;

export const setPasswordFormSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, { message: "Re-enter the new password." }),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

export type SetPasswordFormValues = z.infer<typeof setPasswordFormSchema>;

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Enter your current password." }),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, { message: "Re-enter the new password." }),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: "Choose a password you haven't used here before.",
    path: ["newPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
