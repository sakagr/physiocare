import { z } from "zod";

/**
 * Response contract for user-clinic assignments (F2, M8/R2). Client-safe --
 * never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/user-clinic.repository.ts` → `UserClinic` (the
 * `user_clinics` table row), which both `assignUserToClinic` and
 * `removeUserFromClinic` return.
 */
export const userClinicSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  clinic_id: z.string(),
  assigned_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
