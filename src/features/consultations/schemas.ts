import { z } from "zod";

/**
 * Client form schema for a consultation. Feature-owned and separate from the
 * server validator (`AGENTS.md` → *Forms and Validation*).
 *
 * `patientId` and `physiotherapistId` are absent by design: the service
 * copies both from the appointment and never takes them from input, so a form
 * that offered them would be offering something the server ignores.
 */
export const consultationFormSchema = z.object({
  symptoms: z.string().trim().optional(),
  painAreas: z.array(z.string()).optional(),
  painScale: z.union([z.number(), z.string()]).optional(),
  diagnosisNotes: z.string().trim().optional(),
  followupNotes: z.string().trim().optional(),
});

export type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

export const EMPTY_CONSULTATION_FORM_VALUES: ConsultationFormValues = {
  symptoms: "",
  painAreas: [],
  painScale: "",
  diagnosisNotes: "",
  followupNotes: "",
};

/**
 * A fixed client-side vocabulary against a `jsonb` array, the same reasoning
 * as F5's record types: an enum would make adding an area a migration, and
 * free text would make it unsearchable.
 */
export const PAIN_AREA_OPTIONS = [
  "neck",
  "shoulder",
  "upper_back",
  "lower_back",
  "hip",
  "knee",
  "ankle",
  "elbow",
  "wrist",
].map((value) => ({ value, label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) }));
