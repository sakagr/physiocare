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
 * `User & { role: Role }` -- what `activateUser`, `deactivateUser`,
 * `changeUserRole`, and `updateUserProfile` return.
 */
export const userWithRoleSchema = userSchema.extend({ role: roleSchema });

/**
 * A role the caller may assign -- to a newly created user, or as a target
 * role in a role change. Server-supplied so the client never compares role
 * names (D9, ADR-0010): `display_name` is what renders, `name` is identity
 * only.
 */
export const assignableRoleSchema = z.object({
  name: z.string(),
  display_name: z.string(),
});

/**
 * `userWithRoleSchema` plus a server-computed per-item permission hint
 * (ADR-0010): whether the caller may manage (edit/activate/deactivate/
 * re-role/offboard) this specific row. Advisory only -- the service-layer
 * predicates (`canManageTargetUser`, `canUpdateUserRole`) remain the actual
 * security boundary; this field exists so the UI can hide actions per
 * `UX.md:136` instead of showing them and then failing.
 */
export const manageableUserSchema = userWithRoleSchema.extend({ canManage: z.boolean() });

/** GET /api/users/{id} -- what `getUserDetails` returns. */
export const userDetailResponseSchema = manageableUserSchema;

/**
 * GET /api/users. `assignableRoles` is caller-derived, not per-row (FL3) --
 * one list for the whole page, used by the create-user and change-role
 * pickers.
 */
export const userListResponseSchema = pagedResultSchema(manageableUserSchema).extend({
  assignableRoles: z.array(assignableRoleSchema),
});

/**
 * GET /api/clinics/{id}/users -- a bare array, not paginated. Role-embedded
 * (D10 ii) so a clinic's member list can show roles without a second lookup;
 * not extended with `canManage` -- this is not a user-management surface.
 */
export const clinicUsersResponseSchema = z.array(userWithRoleSchema);

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

/**
 * GET /api/users/{id}/compensation -- the full history, newest-first (D2).
 * Owner-only (ADR-0011).
 */
export const userCompensationHistorySchema = z.array(userCompensationSchema);

/**
 * POST /api/users/{id}/reset-password -- the admin-mediated reset (Hole B).
 * Same reveal-once contract as `createOrganizationUserResultSchema`, but
 * `initialPassword` is always present -- a reset always produces one, unlike
 * creation where the field's optionality has no other use.
 */
export const resetUserPasswordResultSchema = z.object({
  userId: z.string(),
  username: z.string(),
  initialPassword: z.string(),
});
