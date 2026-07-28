import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Clinics domain (F2, M8/R2). Client-safe --
 * never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/clinic.repository.ts` → `Clinic` (the `clinics`
 * table row), which every clinic-mutating service returns unchanged.
 */
export const clinicSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  clinic_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  gst_number: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/clinics. */
export const clinicListResponseSchema = pagedResultSchema(clinicSchema);

/** GET /api/users/{id}/clinics -- a bare array, not paginated. */
export const userClinicsResponseSchema = z.array(clinicSchema);
