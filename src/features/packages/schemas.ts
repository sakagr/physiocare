import { z } from "zod";

/**
 * Client form schema for creating/editing a catalogue package.
 * Feature-owned and separate from the server validator (AGENTS.md → Forms
 * and Validation).
 */
export const packageFormSchema = z.object({
  packageName: z.string().trim().min(2, { message: "Enter at least 2 characters." }),
  // Plain numbers, not `z.coerce.number()`: the Controller-driven
  // NumberInputs already supply numeric values, and coercion here would split
  // the resolver's input/output types and break zodResolver's generic
  // inference (same reason as users/schemas.ts).
  totalSessions: z.number().int().positive({ message: "Enter at least 1 session." }),
  packagePrice: z.number().nonnegative({ message: "Enter a price of 0 or more." }),
  validityDays: z.number().int().positive({ message: "Enter at least 1 day." }),
});

export type PackageFormValues = z.infer<typeof packageFormSchema>;

export const EMPTY_PACKAGE_FORM_VALUES: PackageFormValues = {
  packageName: "",
  totalSessions: 1,
  packagePrice: 0,
  validityDays: 30,
};
