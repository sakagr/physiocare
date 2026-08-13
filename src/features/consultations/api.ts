import { api } from "@/lib/api/client";
import type { Consultation } from "@/types/contracts/consultation";

/** The Consultations reads and commands (F6). */

/**
 * The appointment's consultation, or `null` when the visit has not been
 * recorded yet (D5). A 200 with a null body, deliberately not a 404: "not
 * started yet" is the normal state on the consultation destination, and a 404
 * would route the client into the not-found frame.
 */
export function getConsultationForAppointment(appointmentId: string): Promise<Consultation | null> {
  return api.get<Consultation | null>(`/api/appointments/${appointmentId}/consultation`);
}

export interface ConsultationFormRequest {
  symptoms?: string;
  painAreas?: string[];
  painScale?: number;
  diagnosisNotes?: string;
  followupNotes?: string;
}

export function createConsultation(
  appointmentId: string,
  input: ConsultationFormRequest
): Promise<Consultation> {
  return api.post<Consultation>(`/api/appointments/${appointmentId}/consultation`, input);
}

export function updateConsultation(id: string, input: ConsultationFormRequest): Promise<Consultation> {
  return api.patch<Consultation>(`/api/consultations/${id}`, input);
}
