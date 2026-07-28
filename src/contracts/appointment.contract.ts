import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Appointments domain (F2, M8/R5). Client-safe
 * -- never imports from `src/server/**` or `src/types/database.ts`.
 * Mirrors `src/server/repositories/appointment.repository.ts` →
 * `Appointment` (the `appointments` table row).
 */
export const appointmentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  patient_id: z.string(),
  clinic_id: z.string(),
  physiotherapist_id: z.string(),
  appointment_time: z.string(),
  appointment_type: z.enum(["initial_consultation", "follow_up", "therapy_session", "assessment"]),
  status: z.enum(["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"]),
  notes: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/appointments. */
export const appointmentListResponseSchema = pagedResultSchema(appointmentSchema);
