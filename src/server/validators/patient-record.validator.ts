import { z } from "zod";

/**
 * Validation schema for patient record metadata. File presence, MIME type,
 * and size are transport-specific and are validated in the API route.
 */
export const createPatientRecordSchema = z.object({
  recordType: z
    .string()
    .min(1, { message: "Record type is required." })
    .max(50, { message: "Record type cannot exceed 50 characters." })
    .trim(),
  title: z
    .string()
    .min(1, { message: "Title is required." })
    .max(200, { message: "Title cannot exceed 200 characters." })
    .trim(),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type CreatePatientRecordInput = z.infer<typeof createPatientRecordSchema>;

export function validateCreatePatientRecordInput(input: unknown): CreatePatientRecordInput {
  return createPatientRecordSchema.parse(input);
}
