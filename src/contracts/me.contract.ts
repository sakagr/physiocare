import { z } from "zod";

/**
 * The current-user response contract (`GET /api/users/me`), F2/ADR-0008.
 *
 * Client-safe: never imports from `src/server/**` or `src/types/database.ts`.
 * This is the single source `src/types/contracts/me.ts` re-exports its types
 * from -- the hand-authored seam ADR-0003 named, now replaced without
 * changing any consumer of that module. It is also the response schema the
 * OpenAPI generator binds to `GET /api/users/me` in the registry.
 */

/**
 * The contract-owned capability vocabulary. Deliberately decoupled from the
 * backend authorization predicate names in `authorization.service.ts` -- the
 * wire format never exposes them, so predicates can be renamed or recomposed
 * without changing any client.
 */
export const CAPABILITIES = [
  "patients:view",
  "patients:manage",
  "patientRecords:delete",
  "appointments:oversee",
  "appointments:manage",
  "attendance:oversee",
  "attendance:record",
  "attendance:manage",
  "invoices:access",
  "packages:view",
  "packages:manage",
  "patientPackages:manage",
  "reports:view",
  "users:manage",
  "clinics:manage",
  "settings:manage",
  "organization:manage",
  "subscription:manage",
  "auditLogs:view",
  "platformApi:explore",
  "compensation:view",
] as const;

export const capabilitySchema = z.enum(CAPABILITIES);

/** Which shell/namespace a user belongs to. Drives the landing resolver. */
export const userGroupSchema = z.enum(["platform", "org"]);

/** The user's application role, for display only -- never gate on this. */
export const currentUserRoleSchema = z.object({
  /** Immutable system name (e.g. `ORG_OWNER`). Identity only; never rendered. */
  name: z.string(),
  /** Human display name (e.g. `Owner`). Rendered in the UI. */
  displayName: z.string(),
});

/** The organization a user belongs to (null for platform users). */
export const currentUserOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * A clinic the user may work in, as listed by the shell's clinic switcher.
 * The management tier sees every active organization clinic; everyone else
 * sees only their assignments.
 */
export const currentUserClinicSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Identity, role, group, organization context, and the coarse capability map
 * computed server-side. The client consumes `capabilities` and never derives
 * them from `role`.
 */
export const currentUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  role: currentUserRoleSchema,
  group: userGroupSchema,
  organization: currentUserOrganizationSchema.nullable(),
  /** The granted capability tokens only; absence means not granted. */
  capabilities: z.array(capabilitySchema),
  /** Clinics the user may work in; empty for platform users. */
  clinics: z.array(currentUserClinicSchema),
});
