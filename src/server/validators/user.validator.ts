import { z } from "zod";
import type { AppRole } from "../repositories/user.repository";

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
  role: z
    .enum([
      "SUPER_ADMIN",
      "PLATFORM_SUPPORT",
      "PLATFORM_SALES",
      "PLATFORM_BILLING",
      "ORG_OWNER",
      "ORG_ADMIN",
      "ORG_PHYSIOTHERAPIST",
      "ORG_RECEPTIONIST",
      "ORG_ACCOUNTANT",
    ])
    .refine((val): val is AppRole => val.startsWith("ORG_"), {
      message: "Only organization roles are allowed.",
    }),
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
