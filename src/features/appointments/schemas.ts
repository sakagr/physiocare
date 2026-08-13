import { z } from "zod";

/**
 * Client form schemas for the Appointments domain. Feature-owned and separate
 * from the server validators (`AGENTS.md` → *Forms and Validation*); the
 * server's remain the authoritative runtime validation.
 *
 * `clinicId` is required before `physiotherapistId` can be resolved at all --
 * the physiotherapist picker reads that clinic's assigned staff. That is not
 * an accident of which endpoints Reception may call (`GET /api/users` is
 * Owner/Admin-only): the booking rule the server enforces *is*
 * "physiotherapist assigned to this clinic", so clinic-then-physiotherapist
 * mirrors it.
 */
export const appointmentFormSchema = z.object({
  patientId: z.string().min(1, { message: "Choose a patient." }),
  clinicId: z.string().min(1, { message: "Choose a clinic." }),
  physiotherapistId: z.string().min(1, { message: "Choose a physiotherapist." }),
  appointmentTime: z.string().min(1, { message: "Choose a date and time." }),
  appointmentType: z.string().min(1, { message: "Choose an appointment type." }),
  notes: z.string().trim().optional(),
});

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

export const EMPTY_APPOINTMENT_FORM_VALUES: AppointmentFormValues = {
  patientId: "",
  clinicId: "",
  physiotherapistId: "",
  appointmentTime: "",
  appointmentType: "therapy_session",
  notes: "",
};
