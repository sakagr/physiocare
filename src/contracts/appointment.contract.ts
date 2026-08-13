import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Appointments domain (F2, M8/R5). Client-safe
 * -- never imports from `src/server/**` or `src/types/database.ts`.
 * Mirrors `src/server/repositories/appointment.repository.ts` →
 * `Appointment` (the `appointments` table row).
 */
export const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]);

export const appointmentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  patient_id: z.string(),
  clinic_id: z.string(),
  physiotherapist_id: z.string(),
  appointment_time: z.string(),
  appointment_type: z.enum(["initial_consultation", "follow_up", "therapy_session", "assessment"]),
  status: appointmentStatusSchema,
  notes: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/**
 * The appointment **read** shape (F6, D1): the row plus the display projection
 * every appointment surface renders, since the row itself carries only UUIDs.
 *
 * Deliberately separate from `appointmentSchema`, which stays the bare row and
 * remains what the write operations return (D12). Requiring the projection on
 * a write response would force every write to re-read through the joined
 * select purely to satisfy its own contract -- the write-then-re-read round
 * trip a database view was rejected for. Nothing needs it: mutation feedback
 * is pessimistic (`UX.md` → *Mutation feedback*), so the projection arrives on
 * the refetch the client already performs.
 *
 * Each nested object is nullable because RLS filters a joined row to `null`
 * rather than erroring (ADR-0011). That it is never null in practice for a
 * caller who can see the appointment is proved per role through real session
 * clients, not assumed here.
 */
export const appointmentReadSchema = appointmentSchema.extend({
  patient: z
    .object({ id: z.string(), full_name: z.string(), patient_code: z.string() })
    .nullable(),
  physiotherapist: z.object({ id: z.string(), full_name: z.string() }).nullable(),
  clinic: z.object({ id: z.string(), clinic_name: z.string() }).nullable(),

  /**
   * Per-item permission hints (F6, D13; ADR-0010). Advisory only -- the
   * server-side predicates remain the boundary.
   *
   * `allowedTransitions` is the status transitions this caller may actually
   * perform on this row: the legality matrix when they may act on it, and
   * empty when they may not. The client renders one control per element and
   * **never holds a copy of the matrix**, which is why this is a list rather
   * than a `canManage` boolean -- a boolean would have forced the matrix
   * client-side, where it would drift silently against the server's.
   */
  allowedTransitions: z.array(appointmentStatusSchema),
  /**
   * Whether this caller may author the appointment's consultation. Governs
   * the prescription section too (D14): a consultation's physiotherapist is
   * copied from its appointment and cannot afterwards diverge, so
   * `canManagePrescription` agrees with this for every consultation reachable
   * from this row.
   */
  canManageConsultation: z.boolean(),
});

/** GET /api/appointments. */
export const appointmentListResponseSchema = pagedResultSchema(appointmentReadSchema);
