import { z } from "zod";
import { sharedListQuerySchema } from "./shared.validator";

const appointmentTypeSchema = z.enum(["initial_consultation", "follow_up", "therapy_session", "assessment"]);
const appointmentStatusSchema = z.enum(["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"]);

/**
 * Validation schema for creating a new appointment.
 */
export const createAppointmentSchema = z.object({
  patientId: z.string().uuid({ message: "Invalid patient ID format." }),
  clinicId: z.string().uuid({ message: "Invalid clinic ID format." }),
  physiotherapistId: z.string().uuid({ message: "Invalid physiotherapist ID format." }),
  appointmentTime: z.coerce.date({ message: "Invalid appointment time." }).transform((date) => date.toISOString()),
  appointmentType: appointmentTypeSchema.optional(),
  notes: z.string().trim().optional().or(z.literal("")),
});

/**
 * Validation schema for updating appointment scheduling details.
 * Patient, clinic, and physiotherapist cannot be reassigned; cancel and
 * recreate the appointment instead.
 */
export const updateAppointmentSchema = z.object({
  appointmentTime: z.coerce.date({ message: "Invalid appointment time." }).transform((date) => date.toISOString()).optional(),
  appointmentType: appointmentTypeSchema.optional(),
  notes: z.string().trim().optional().or(z.literal("")),
});

/**
 * Validation schema for updating an appointment's status.
 * patientPackageId is only meaningful when transitioning to "completed": it
 * identifies which patient package session to consume. An appointment has
 * no intrinsic package linkage of its own -- it becomes package-linked only
 * when a caller supplies this at completion time.
 */
export const updateAppointmentStatusSchema = z.object({
  status: appointmentStatusSchema,
  patientPackageId: z.string().uuid({ message: "Invalid patient package ID format." }).optional(),
});

/**
 * Validation schema for listing/searching appointments.
 */
export const appointmentListQuerySchema = sharedListQuerySchema.extend({
  patientId: z.string().uuid().optional(),
  clinicId: z.string().uuid().optional(),
  physiotherapistId: z.string().uuid().optional(),
  status: appointmentStatusSchema.optional(),
  dateFrom: z.coerce.date().transform((date) => date.toISOString()).optional(),
  dateTo: z.coerce.date().transform((date) => date.toISOString()).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;

export function validateCreateAppointmentInput(input: unknown): CreateAppointmentInput {
  return createAppointmentSchema.parse(input);
}

export function validateUpdateAppointmentInput(input: unknown): UpdateAppointmentInput {
  return updateAppointmentSchema.parse(input);
}

export function validateUpdateAppointmentStatusInput(input: unknown): UpdateAppointmentStatusInput {
  return updateAppointmentStatusSchema.parse(input);
}
