import { api } from "@/lib/api/client";
import type { Prescription, PrescriptionListResponse } from "@/types/contracts/prescription";

/** The Prescriptions reads and commands (F6). */

export function listPrescriptions(consultationId: string): Promise<PrescriptionListResponse> {
  return api.get<PrescriptionListResponse>(
    `/api/consultations/${consultationId}/prescriptions?page=1&limit=50`
  );
}

export interface PrescriptionFormRequest {
  advice?: string;
  followupDate?: string;
}

export function createPrescription(
  consultationId: string,
  input: PrescriptionFormRequest
): Promise<Prescription> {
  return api.post<Prescription>(`/api/consultations/${consultationId}/prescriptions`, input);
}

export function updatePrescription(id: string, input: PrescriptionFormRequest): Promise<Prescription> {
  return api.patch<Prescription>(`/api/prescriptions/${id}`, input);
}
