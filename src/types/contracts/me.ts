/**
 * Current-user contract returned by `GET /api/users/me`.
 *
 * Client-safe: this module must never import from `src/server` or
 * `src/types/database.ts`. It is the hand-authored seam that phase F2 will
 * replace with types generated from the OpenAPI spec, without changing any
 * consumer. See AGENTS.md → "Error Handling and Types".
 */

/**
 * The contract-owned capability vocabulary. These tokens are a deliberate
 * part of the API contract and are intentionally decoupled from the backend
 * authorization predicate names — the wire format never exposes
 * `authorization.service.ts` internals. Tokens read as UX/navigation
 * concerns (`domain:action`) so backend predicates can be renamed or
 * recomposed without changing any client.
 */
export const CAPABILITIES = [
  "patients:view",
  "appointments:oversee",
  "attendance:oversee",
  "invoices:access",
  "packages:view",
  "reports:view",
  "users:manage",
  "clinics:manage",
  "settings:manage",
  "subscription:manage",
  "auditLogs:view",
] as const;

/** A single capability token from the contract vocabulary. */
export type Capability = (typeof CAPABILITIES)[number];

/** Which shell/namespace a user belongs to. Drives the landing resolver. */
export type UserGroup = "platform" | "org";

/** The user's application role, for display only — never gate on this. */
export interface CurrentUserRole {
  /** Immutable system name (e.g. `ORG_OWNER`). Identity only; never rendered. */
  name: string;
  /** Human display name (e.g. `Owner`). Rendered in the UI. */
  displayName: string;
}

/** The organization a user belongs to (null for platform users). */
export interface CurrentUserOrganization {
  id: string;
  name: string;
}

/**
 * A clinic the user may work in, as listed by the shell's clinic switcher.
 * The management tier sees every active organization clinic; everyone else
 * sees only their assignments.
 */
export interface CurrentUserClinic {
  id: string;
  name: string;
}

/**
 * Identity, role, group, organization context, and the coarse capability map
 * computed server-side. The client consumes `capabilities` and never derives
 * them from `role`.
 */
export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: CurrentUserRole;
  group: UserGroup;
  organization: CurrentUserOrganization | null;
  /** The granted capability tokens only; absence means not granted. */
  capabilities: Capability[];
  /** Clinics the user may work in; empty for platform users. */
  clinics: CurrentUserClinic[];
}
