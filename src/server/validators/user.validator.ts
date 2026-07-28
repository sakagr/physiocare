import { z } from "zod";

/**
 * The roles assignable to an organization user. Narrower than the full
 * `AppRole` union (which also carries `SUPER_ADMIN` and the `PLATFORM_*`
 * roles) by construction, so a submitted platform role is rejected by the
 * enum itself rather than by a follow-up `.refine()` -- which also makes it
 * visible in the generated OpenAPI spec (F2, decision #10): the previous
 * `.refine()` shape let the spec document all 8 roles as legal here, which
 * the server would then reject.
 */
const organizationRoleSchema = z.enum(
  ["ORG_OWNER", "ORG_ADMIN", "ORG_PHYSIOTHERAPIST", "ORG_RECEPTIONIST"],
  { message: "Only organization roles are allowed." }
);

/**
 * Zod validation schema for creating a new organization user.
 */
export const createOrganizationUserSchema = z.object({
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long." })
    .max(50, { message: "Username cannot exceed 50 characters." })
    .regex(/^[a-zA-Z0-9._-]+$/, {
      message: "Username can only contain alphanumeric characters, dots, underscores, and hyphens.",
    })
    .toLowerCase()
    .trim(),
  fullName: z
    .string()
    .min(2, { message: "Full name must be at least 2 characters long." })
    .max(100, { message: "Full name cannot exceed 100 characters." })
    .trim(),
  email: z
    .string()
    .toLowerCase()
    .trim()
    .pipe(z.email({ message: "Please enter a valid email address." })),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
  role: organizationRoleSchema,
});

/**
 * TypeScript type inferred from the user creation schema.
 */
export type CreateOrganizationUserInput = z.infer<typeof createOrganizationUserSchema>;

/**
 * Validates and parses the input for creating a new organization user.
 *
 * @param input - The raw input to validate.
 * @returns The validated user creation input.
 * @throws ZodError if validation fails.
 */
export function validateCreateOrganizationUserInput(input: unknown): CreateOrganizationUserInput {
  return createOrganizationUserSchema.parse(input);
}

/**
 * Zod validation schema for updating user profile info.
 */
export const updateUserProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, { message: "Full name must be at least 2 characters long." })
    .max(100, { message: "Full name cannot exceed 100 characters." })
    .trim()
    .optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
});

/**
 * TypeScript type inferred from the user profile update schema.
 */
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

/**
 * Validates and parses the input for updating a user profile.
 */
export function validateUpdateUserProfileInput(input: unknown): UpdateUserProfileInput {
  return updateUserProfileSchema.parse(input);
}

/**
 * Zod validation schema for updating user role.
 */
export const changeUserRoleSchema = z.object({
  role: organizationRoleSchema,
});

/**
 * TypeScript type inferred from the user role update schema.
 */
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;

/**
 * Validates and parses the input for changing a user role.
 */
export function validateChangeUserRoleInput(input: unknown): ChangeUserRoleInput {
  return changeUserRoleSchema.parse(input);
}
