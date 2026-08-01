import { z } from "zod";

/**
 * Zod validation schema for creating a new organization.
 */
export const createOrganizationSchema = z.object({
  organizationName: z
    .string()
    .min(2, { message: "Organization name must be at least 2 characters long." })
    .max(100, { message: "Organization name cannot exceed 100 characters." })
    .trim(),
  adminFullName: z
    .string()
    .min(2, { message: "Admin full name must be at least 2 characters long." })
    .max(100, { message: "Admin full name cannot exceed 100 characters." })
    .trim(),
  adminEmail: z
    .string()
    .toLowerCase()
    .trim()
    .pipe(z.email({ message: "Please enter a valid email address." })),
  adminUsername: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long." })
    .max(50, { message: "Username cannot exceed 50 characters." })
    .regex(/^[a-zA-Z0-9._-]+$/, {
      message: "Username can only contain alphanumeric characters, dots, underscores, and hyphens.",
    })
    .toLowerCase()
    .trim(),
});

/**
 * Validation schema for updating an organization's profile. Both fields
 * optional (partial update); `defaultCurrencyCode` is validated for format
 * only (ISO 4217, 3 uppercase letters) -- whether the code actually exists
 * is the `currencies` foreign key's job, not this schema's.
 */
export const updateOrganizationProfileSchema = z.object({
  organizationName: z
    .string()
    .min(2, { message: "Organization name must be at least 2 characters long." })
    .max(100, { message: "Organization name cannot exceed 100 characters." })
    .trim()
    .optional(),
  defaultCurrencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, { message: "Currency code must be 3 uppercase letters (ISO 4217)." })
    .optional(),
});

/**
 * TypeScript type inferred from the creation schema.
 */
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/**
 * TypeScript type inferred from the profile update schema.
 */
export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;

/**
 * Validates and parses the input for creating a new organization.
 *
 * @param input - The raw input to validate.
 * @returns The validated organization input.
 * @throws ZodError if validation fails.
 */
export function validateCreateOrganizationInput(input: unknown): CreateOrganizationInput {
  return createOrganizationSchema.parse(input);
}

/**
 * Validates and parses the input for updating an organization's profile.
 *
 * @param input - The raw input to validate.
 * @returns The validated profile input.
 * @throws ZodError if validation fails.
 */
export function validateUpdateOrganizationProfileInput(input: unknown): UpdateOrganizationProfileInput {
  return updateOrganizationProfileSchema.parse(input);
}
