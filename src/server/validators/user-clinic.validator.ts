import { z } from "zod";

/**
 * Validation schema for assigning a user to a clinic.
 */
export const assignUserClinicSchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID format." }),
  clinicId: z.string().uuid({ message: "Invalid clinic ID format." }),
});

export type AssignUserClinicInput = z.infer<typeof assignUserClinicSchema>;

export function validateAssignUserClinicInput(input: unknown): AssignUserClinicInput {
  return assignUserClinicSchema.parse(input);
}
