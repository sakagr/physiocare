import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Appointment } from "../repositories/appointment.repository";
import { findAppointmentById } from "../repositories/appointment.repository";
import { updateAppointmentStatus, isLegalAppointmentStatusTransition } from "./appointment.service";
import { consumePackageSession, reversePackageSessionConsumption } from "./patient-package.service";
import { canAccessAppointment } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { UpdateAppointmentStatusInput } from "../validators/appointment.validator";

/**
 * Orchestrates an appointment status transition together with its
 * cross-domain side effect on package session consumption. The Appointment
 * and Patient Package domain services never call each other directly (see
 * AGENTS.md Service boundaries) -- this application service coordinates
 * both for the one workflow that spans them.
 *
 * Ordering: authorization and transition legality are checked before any
 * write. A completing transition consumes the session before the
 * appointment status is persisted, so the common, expected failures
 * (exhausted, expired, already recorded) never leave the appointment stuck
 * in "completed" with no valid consumption. A completed -> cancelled
 * reversal runs only after the status change itself has been persisted,
 * since there is nothing to reverse until "completed" has actually been
 * undone. Neither step participates in a single database transaction with
 * the appointment write (no cross-service transaction mechanism exists in
 * this codebase); a crash between them is the same narrow, non-adversarial
 * risk window already accepted for the two-write case within
 * consumePackageSession itself.
 */
export async function transitionAppointmentStatus(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string,
  input: UpdateAppointmentStatusInput
): Promise<Appointment> {
  const before = await findAppointmentById(supabase, appointmentId);
  if (!before) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessAppointment(supabase, callerUserId, appointmentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  if (!isLegalAppointmentStatusTransition(before.status, input.status)) {
    throw new AppError(
      `Cannot transition an appointment from ${before.status} to ${input.status}`,
      ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION
    );
  }

  if (input.status === "completed" && input.patientPackageId) {
    await consumePackageSession(supabase, before.organization_id, input.patientPackageId, appointmentId);
  }

  const updated = await updateAppointmentStatus(supabase, callerUserId, appointmentId, { status: input.status });

  if (before.status === "completed" && input.status === "cancelled") {
    await reversePackageSessionConsumption(supabase, before.organization_id, appointmentId);
  }

  return updated;
}
