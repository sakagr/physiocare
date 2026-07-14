import { z } from "zod";
import { paginationSchema } from "./shared.validator";

const packageStatusSchema = z.enum(["active", "completed", "expired", "cancelled"]);

/**
 * Validation schema for assigning a package to a patient.
 */
export const createPatientPackageSchema = z.object({
  patientId: z.string().uuid({ message: "Invalid patient ID format." }),
  packageId: z.string().uuid({ message: "Invalid package ID format." }),
  purchasedOn: z.string().date({ message: "Invalid purchase date." }).optional(),
});

/**
 * Validation schema for updating a patient package assignment.
 * Session counts and package snapshot fields are never client-writable --
 * they are owned by the purchase itself and by the session consumption
 * workflow (see patient-package.service.ts consumePackageSession()).
 */
export const updatePatientPackageSchema = z.object({
  extendedValidityTo: z.string().date({ message: "Invalid extended validity date." }).optional(),
  status: z.literal("cancelled").optional(),
});

/**
 * Validation schema for the patient package list query.
 */
export const patientPackageListQuerySchema = paginationSchema.extend({
  patientId: z.string().uuid({ message: "Invalid patient ID format." }).optional(),
  status: packageStatusSchema.optional(),
});

export type CreatePatientPackageInput = z.infer<typeof createPatientPackageSchema>;
export type UpdatePatientPackageInput = z.infer<typeof updatePatientPackageSchema>;
export type PatientPackageListQuery = z.infer<typeof patientPackageListQuerySchema>;

export function validateCreatePatientPackageInput(input: unknown): CreatePatientPackageInput {
  return createPatientPackageSchema.parse(input);
}

export function validateUpdatePatientPackageInput(input: unknown): UpdatePatientPackageInput {
  return updatePatientPackageSchema.parse(input);
}
