import { z } from "zod";

/**
 * Validation schema for creating a new prescription.
 */
export const createPrescriptionSchema = z.object({
  consultationId: z.string().uuid({ message: "Invalid consultation ID format." }),
  advice: z.string().trim().optional().or(z.literal("")),
  followupDate: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), { message: "Invalid follow-up date." }),
});

/**
 * Validation schema for updating an existing prescription. The referenced
 * consultation cannot be changed.
 */
export const updatePrescriptionSchema = createPrescriptionSchema.omit({ consultationId: true }).partial();

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;

export function validateCreatePrescriptionInput(input: unknown): CreatePrescriptionInput {
  return createPrescriptionSchema.parse(input);
}

export function validateUpdatePrescriptionInput(input: unknown): UpdatePrescriptionInput {
  return updatePrescriptionSchema.parse(input);
}
