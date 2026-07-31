import { z } from "zod";

/**
 * Client form schema for creating/editing a clinic. Feature-owned and
 * separate from the server validator (AGENTS.md → Forms and Validation).
 */
export const clinicFormSchema = z.object({
  clinicName: z.string().trim().min(2, { message: "Enter at least 2 characters." }),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  gstNumber: z.string().trim().optional(),
});

export type ClinicFormValues = z.infer<typeof clinicFormSchema>;

export const EMPTY_CLINIC_FORM_VALUES: ClinicFormValues = {
  clinicName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  gstNumber: "",
};
