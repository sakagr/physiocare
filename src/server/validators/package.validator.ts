import { z } from "zod";
import { sharedListQuerySchema } from "./shared.validator";

/**
 * Validation schema for creating a new package.
 */
export const createPackageSchema = z.object({
  packageName: z
    .string()
    .min(2, { message: "Package name must be at least 2 characters long." })
    .max(150, { message: "Package name cannot exceed 150 characters." })
    .trim(),
  totalSessions: z.coerce
    .number()
    .int()
    .positive({ message: "Total sessions must be a positive integer." }),
  packagePrice: z.coerce
    .number()
    .min(0, { message: "Package price cannot be negative." }),
  validityDays: z.coerce
    .number()
    .int()
    .positive({ message: "Validity days must be a positive integer." }),
});

/**
 * Validation schema for updating an existing package (all fields optional).
 */
export const updatePackageSchema = createPackageSchema.partial();

/**
 * Validation schema for the package list query.
 */
export const packageListQuerySchema = sharedListQuerySchema;

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type PackageListQuery = z.infer<typeof packageListQuerySchema>;

export function validateCreatePackageInput(input: unknown): CreatePackageInput {
  return createPackageSchema.parse(input);
}

export function validateUpdatePackageInput(input: unknown): UpdatePackageInput {
  return updatePackageSchema.parse(input);
}
