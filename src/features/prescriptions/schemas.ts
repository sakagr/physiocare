import { z } from "zod";

/**
 * Client form schema for a prescription. A consultation may carry several,
 * so this is an add/edit form rather than a singleton.
 */
export const prescriptionFormSchema = z.object({
  advice: z.string().trim().min(1, { message: "Enter the advice." }),
  followupDate: z.string().trim().optional(),
});

export type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;

export const EMPTY_PRESCRIPTION_FORM_VALUES: PrescriptionFormValues = {
  advice: "",
  followupDate: "",
};
