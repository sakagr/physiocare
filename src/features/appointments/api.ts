import { api } from "@/lib/api/client";
import type {
  Appointment,
  AppointmentListResponse,
  AppointmentRead,
} from "@/types/contracts/appointment";

/** The Appointments commands and reads (F6). */

export interface AppointmentListFilters {
  page: number;
  limit: number;
  patientId?: string;
  clinicId?: string;
  physiotherapistId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters) as [key: string, value: string | number | boolean | undefined][]) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listAppointments(filters: AppointmentListFilters): Promise<AppointmentListResponse> {
  return api.get<AppointmentListResponse>(`/api/appointments${buildQueryString(filters)}`);
}

export function getAppointment(id: string): Promise<AppointmentRead> {
  return api.get<AppointmentRead>(`/api/appointments/${id}`);
}

export interface AppointmentFormRequest {
  patientId: string;
  clinicId: string;
  physiotherapistId: string;
  appointmentTime: string;
  appointmentType: string;
  notes?: string;
}

/**
 * The write responses are the bare appointment row, without the display
 * projection or the permission hints (D12) -- a write returns what it
 * persisted rather than re-reading it through the joined select. Mutation
 * feedback is pessimistic, so callers invalidate and the projection arrives
 * on the refetch they already perform.
 */
export function createAppointment(input: AppointmentFormRequest): Promise<Appointment> {
  return api.post<Appointment>("/api/appointments", input);
}

/** Time, type and notes only; patient, clinic and physiotherapist are fixed. */
export type AppointmentRescheduleRequest = Partial<
  Pick<AppointmentFormRequest, "appointmentTime" | "appointmentType" | "notes">
>;

export function updateAppointment(
  id: string,
  input: AppointmentRescheduleRequest
): Promise<Appointment> {
  return api.patch<Appointment>(`/api/appointments/${id}`, input);
}

export function updateAppointmentStatus(
  id: string,
  input: { status: string; patientPackageId?: string }
): Promise<Appointment> {
  return api.patch<Appointment>(`/api/appointments/${id}/status`, input);
}
