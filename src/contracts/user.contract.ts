import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Users domain (F2, M8/R2). Client-safe -- never
 * imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/user.repository.ts` → `User`/`Role` (the
 * `users`/`roles` table rows).
 */
export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const userSchema = z.object({
  id: z.string(),
  organization_id: z.string().nullable(),
  full_name: z.string(),
  email: z.string(),
  username: z.string(),
  phone: z.string().nullable(),
  role_id: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/**
 * `User & { role: Role }` -- what `getUserDetails`, `activateUser`,
 * `deactivateUser`, `changeUserRole`, and `updateUserProfile` return.
 */
export const userWithRoleSchema = userSchema.extend({ role: roleSchema });

/** GET /api/users. */
export const userListResponseSchema = pagedResultSchema(userWithRoleSchema);

/** GET /api/clinics/{id}/users -- a bare array, not paginated. */
export const clinicUsersResponseSchema = z.array(userSchema);

/**
 * POST /api/users -- `CreateOrganizationUserResult`. The reveal-once
 * initial password (AGENTS.md → User Onboarding): present on creation,
 * never retrievable afterward.
 */
export const createOrganizationUserResultSchema = z.object({
  userId: z.string(),
  username: z.string(),
  initialPassword: z.string().optional(),
});

/**
 * POST /api/users/{id}/compensation -- mirrors `user_compensations`'
 * table row (`UserCompensation`, commission.service.ts).
 */
export const userCompensationSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  type: z.enum(["none", "percentage", "fixed"]),
  value: z.number(),
  effective_from: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().nullable(),
});
