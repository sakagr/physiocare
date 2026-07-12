import { z } from "zod";

/**
 * Validation schema for creating a new clinic.
 */
export const createClinicSchema = z.object({
  clinicName: z
    .string()
    .min(2, { message: "Clinic name must be at least 2 characters long." })
    .max(100, { message: "Clinic name cannot exceed 100 characters." })
    .trim(),
  email: z
    .string()
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal(""))
    .pipe(z.string().email({ message: "Please enter a valid email address." }).optional().or(z.literal(""))),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  pincode: z.string().trim().optional().or(z.literal("")),
  gstNumber: z.string().trim().optional().or(z.literal("")),
});

/**
 * Validation schema for updating an existing clinic (all fields optional).
 */
export const updateClinicSchema = createClinicSchema.partial();

export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;

export function validateCreateClinicInput(input: unknown): CreateClinicInput {
  return createClinicSchema.parse(input);
}

export function validateUpdateClinicInput(input: unknown): UpdateClinicInput {
  return updateClinicSchema.parse(input);
}
