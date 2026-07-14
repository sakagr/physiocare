import { z } from "zod";

const commissionTypeSchema = z.enum(["none", "percentage", "fixed"]);

/**
 * Validation schema for setting a user's compensation record.
 */
export const setUserCompensationSchema = z
  .object({
    type: commissionTypeSchema,
    value: z.coerce.number({ message: "Invalid compensation value." }),
    effectiveFrom: z.string().date({ message: "Invalid effective date." }).optional(),
  })
  .refine((v) => (v.type === "none" ? v.value === 0 : v.value >= 0), {
    message: "Compensation value must be 0 when type is none.",
    path: ["value"],
  })
  .refine((v) => v.type !== "percentage" || (v.value >= 0 && v.value <= 100), {
    message: "A percentage compensation value must be between 0 and 100.",
    path: ["value"],
  });

export type SetUserCompensationInput = z.infer<typeof setUserCompensationSchema>;

export function validateSetUserCompensationInput(input: unknown): SetUserCompensationInput {
  return setUserCompensationSchema.parse(input);
}
