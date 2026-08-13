import type { z } from "zod";
import { prescriptionSchema, prescriptionListResponseSchema } from "@/contracts/prescription.contract";

/**
 * Response types for the Prescriptions domain (F6). Client-safe: never
 * imports from `src/server` or `src/types/database.ts`.
 */
export type Prescription = z.infer<typeof prescriptionSchema>;

/** GET /api/consultations/{id}/prescriptions. */
export type PrescriptionListResponse = z.infer<typeof prescriptionListResponseSchema>;
