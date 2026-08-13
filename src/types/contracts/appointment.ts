import type { z } from "zod";
import {
  appointmentSchema,
  appointmentReadSchema,
  appointmentStatusSchema,
  appointmentListResponseSchema,
} from "@/contracts/appointment.contract";

/**
 * Response types for the Appointments domain (F6). Client-safe: this module
 * must never import from `src/server` or `src/types/database.ts`.
 * Re-exported `z.infer`s of `src/contracts/appointment.contract.ts`, the
 * single source both this module and the generated OpenAPI spec derive from
 * (ADR-0008).
 */

/** The bare row, as returned by every appointment *write* (D12). */
export type Appointment = z.infer<typeof appointmentSchema>;

/**
 * The row plus its display projection and per-item permission hints, as
 * returned by every appointment *read*. This is what surfaces render:
 * `patient`/`physiotherapist`/`clinic` names instead of UUIDs, and
 * `allowedTransitions` instead of a client-side copy of the status matrix.
 */
export type AppointmentRead = z.infer<typeof appointmentReadSchema>;

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

/** GET /api/appointments. */
export type AppointmentListResponse = z.infer<typeof appointmentListResponseSchema>;
