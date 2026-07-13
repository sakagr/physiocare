import { z } from "zod";
import { paginationSchema } from "./shared.validator";

/**
 * Validation schema for creating a new consultation.
 */
export const createConsultationSchema = z.object({
  appointmentId: z.string().uuid({ message: "Invalid appointment ID format." }),
  symptoms: z.string().trim().optional().or(z.literal("")),
  // Defaults to [] in consultation.service.ts when omitted; kept optional
  // (not .default([])) here so updateConsultationSchema, derived via
  // .omit().partial(), doesn't inherit a default that would leak into
  // partial update payloads.
  painAreas: z.array(z.string().trim()).optional(),
  painScale: z.coerce.number().int().min(0).max(10).optional(),
  diagnosisNotes: z.string().trim().optional().or(z.literal("")),
  followupNotes: z.string().trim().optional().or(z.literal("")),
});

/**
 * Validation schema for updating an existing consultation. The referenced
 * appointment cannot be changed.
 */
export const updateConsultationSchema = createConsultationSchema.omit({ appointmentId: true }).partial();

/**
 * Validation schema for listing/searching consultations.
 */
export const consultationListQuerySchema = paginationSchema.extend({
  patientId: z.string().uuid().optional(),
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type ConsultationListQuery = z.infer<typeof consultationListQuerySchema>;

export function validateCreateConsultationInput(input: unknown): CreateConsultationInput {
  return createConsultationSchema.parse(input);
}

export function validateUpdateConsultationInput(input: unknown): UpdateConsultationInput {
  return updateConsultationSchema.parse(input);
}
