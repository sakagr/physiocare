import { z } from "zod";

/**
 * Client form schemas for the Patients domain. Feature-owned and separate
 * from the server validators (AGENTS.md → Forms and Validation).
 */
export const patientFormSchema = z.object({
  fullName: z.string().trim().min(2, { message: "Enter at least 2 characters." }),
  gender: z.string().optional(),
  dob: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export const EMPTY_PATIENT_FORM_VALUES: PatientFormValues = {
  fullName: "",
  gender: "",
  dob: "",
  phone: "",
  address: "",
  email: "",
  emergencyContact: "",
};

export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

/**
 * The record-type vocabulary offered at upload. A fixed client-side list
 * against a `text` column: an enum would make adding a type a migration, and
 * a free-text field would make the list unfilterable. Recorded in UX.md so it
 * is not re-invented per surface.
 */
export const RECORD_TYPE_OPTIONS = [
  { value: "xray", label: "X-ray" },
  { value: "mri", label: "MRI" },
  { value: "ct_scan", label: "CT scan" },
  { value: "ultrasound", label: "Ultrasound" },
  { value: "lab_report", label: "Lab report" },
  { value: "prescription", label: "Prescription" },
  { value: "referral_letter", label: "Referral letter" },
  { value: "discharge_summary", label: "Discharge summary" },
  { value: "consent_form", label: "Consent form" },
  { value: "other", label: "Other" },
];

/** Mirrors the route's own limits (`records/route.ts`), which remain authoritative. */
export const MAX_RECORD_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_RECORD_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export const recordUploadFormSchema = z.object({
  recordType: z.string().min(1, { message: "Choose a record type." }),
  title: z.string().trim().min(2, { message: "Enter at least 2 characters." }),
  notes: z.string().trim().optional(),
});

export type RecordUploadFormValues = z.infer<typeof recordUploadFormSchema>;

export const EMPTY_RECORD_UPLOAD_FORM_VALUES: RecordUploadFormValues = {
  recordType: "",
  title: "",
  notes: "",
};
