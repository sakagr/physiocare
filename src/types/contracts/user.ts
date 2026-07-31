import type { z } from "zod";
import {
  roleSchema,
  userSchema,
  userWithRoleSchema,
  assignableRoleSchema,
  manageableUserSchema,
  userDetailResponseSchema,
  userListResponseSchema,
  clinicUsersResponseSchema,
  createOrganizationUserResultSchema,
  userCompensationSchema,
  userCompensationHistorySchema,
  resetUserPasswordResultSchema,
} from "@/contracts/user.contract";

/**
 * Response types for the Users domain (F3). Client-safe: this module must
 * never import from `src/server` or `src/types/database.ts`. Re-exported
 * `z.infer`s of `src/contracts/user.contract.ts`, the single source both
 * this module and the generated OpenAPI spec derive from (ADR-0008).
 */

export type Role = z.infer<typeof roleSchema>;
export type User = z.infer<typeof userSchema>;

/** `User & { role: Role }`. */
export type UserWithRole = z.infer<typeof userWithRoleSchema>;

/** A role the caller may assign -- server-supplied (D9, ADR-0010). */
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

/** `UserWithRole` plus the server-computed `canManage` hint (ADR-0010). */
export type ManageableUser = z.infer<typeof manageableUserSchema>;

/** GET /api/users/{id}. */
export type UserDetailResponse = z.infer<typeof userDetailResponseSchema>;

/** GET /api/users. */
export type UserListResponse = z.infer<typeof userListResponseSchema>;

/** GET /api/clinics/{id}/users. */
export type ClinicUsersResponse = z.infer<typeof clinicUsersResponseSchema>;

/** POST /api/users -- the reveal-once initial password. */
export type CreateOrganizationUserResult = z.infer<typeof createOrganizationUserResultSchema>;

/** A single compensation record. */
export type UserCompensation = z.infer<typeof userCompensationSchema>;

/** GET /api/users/{id}/compensation -- full history, newest-first (D2). */
export type UserCompensationHistory = z.infer<typeof userCompensationHistorySchema>;

/** POST /api/users/{id}/reset-password -- the admin-mediated reset. */
export type ResetUserPasswordResult = z.infer<typeof resetUserPasswordResultSchema>;
