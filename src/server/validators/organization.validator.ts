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
    .email({ message: "Please enter a valid email address." })
    .toLowerCase()
    .trim(),
});

/**
 * TypeScript type inferred from the creation schema.
 */
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

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
