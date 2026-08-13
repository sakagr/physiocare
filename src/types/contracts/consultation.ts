import type { z } from "zod";
import { consultationSchema, consultationListResponseSchema } from "@/contracts/consultation.contract";

/**
 * Response types for the Consultations domain (F6). Client-safe: never
 * imports from `src/server` or `src/types/database.ts`.
 */
export type Consultation = z.infer<typeof consultationSchema>;

/** GET /api/consultations. */
export type ConsultationListResponse = z.infer<typeof consultationListResponseSchema>;
