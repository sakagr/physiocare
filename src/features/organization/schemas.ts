import { z } from "zod";

/**
 * Client form schema for editing the organization profile. Feature-owned
 * and separate from the server validator (AGENTS.md → Forms and Validation).
 */
export const organizationProfileFormSchema = z.object({
  organizationName: z.string().trim().min(2, { message: "Enter at least 2 characters." }),
  defaultCurrencyCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, { message: "Enter a 3-letter currency code, e.g. USD." })
    .transform((value) => value.toUpperCase())
    .or(z.literal("")),
});

export type OrganizationProfileFormValues = z.infer<typeof organizationProfileFormSchema>;
