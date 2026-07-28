import type { z } from "zod";
import {
  CAPABILITIES,
  currentUserClinicSchema,
  currentUserOrganizationSchema,
  currentUserRoleSchema,
  currentUserSchema,
} from "@/contracts/me.contract";

/**
 * Current-user contract returned by `GET /api/users/me`.
 *
 * Client-safe: this module must never import from `src/server` or
 * `src/types/database.ts`. Its types are re-exported `z.infer`s of
 * `src/contracts/me.contract.ts`, the single source both this module and the
 * generated OpenAPI spec derive from (F2, ADR-0008) -- the hand-authored
 * seam ADR-0003 named, replaced without changing any consumer of this
 * module. See AGENTS.md → "Error Handling and Types".
 */

export { CAPABILITIES };

/** A single capability token from the contract vocabulary. */
export type Capability = (typeof CAPABILITIES)[number];

/** Which shell/namespace a user belongs to. Drives the landing resolver. */
export type UserGroup = z.infer<typeof currentUserSchema>["group"];

/** The user's application role, for display only — never gate on this. */
export type CurrentUserRole = z.infer<typeof currentUserRoleSchema>;

/** The organization a user belongs to (null for platform users). */
export type CurrentUserOrganization = z.infer<typeof currentUserOrganizationSchema>;

/**
 * A clinic the user may work in, as listed by the shell's clinic switcher.
 * The management tier sees every active organization clinic; everyone else
 * sees only their assignments.
 */
export type CurrentUserClinic = z.infer<typeof currentUserClinicSchema>;

/**
 * Identity, role, group, organization context, and the coarse capability map
 * computed server-side. The client consumes `capabilities` and never derives
 * them from `role`.
 */
export type CurrentUser = z.infer<typeof currentUserSchema>;
