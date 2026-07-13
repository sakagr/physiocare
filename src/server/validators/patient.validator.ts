import { z } from "zod";
import { sharedListQuerySchema } from "./shared.validator";

const patientGenderSchema = z.enum(["female", "male", "other", "prefer_not_to_say"]);

/**
 * Validation schema for creating a new patient.
 */
export const createPatientSchema = z.object({
  fullName: z
    .string()
    .min(2, { message: "Full name must be at least 2 characters long." })
    .max(150, { message: "Full name cannot exceed 150 characters." })
    .trim(),
  gender: patientGenderSchema.optional(),
  dob: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), { message: "Invalid date of birth." })
    .refine((val) => !val || new Date(val) <= new Date(), { message: "Date of birth cannot be in the future." }),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal(""))
    .pipe(z.string().email({ message: "Please enter a valid email address." }).optional().or(z.literal(""))),
  address: z.string().trim().optional().or(z.literal("")),
  emergencyContact: z
    .string()
    .trim()
    .max(500, { message: "Emergency contact cannot exceed 500 characters." })
    .optional()
    .or(z.literal("")),
});

/**
 * Validation schema for updating an existing patient (all fields optional).
 */
export const updatePatientSchema = createPatientSchema.partial();

/**
 * Validation schema for listing/searching patients.
 */
export const patientListQuerySchema = sharedListQuerySchema.extend({
  gender: patientGenderSchema.optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;

export function validateCreatePatientInput(input: unknown): CreatePatientInput {
  return createPatientSchema.parse(input);
}

export function validateUpdatePatientInput(input: unknown): UpdatePatientInput {
  return updatePatientSchema.parse(input);
}
