import type {
  Capability,
  CurrentUser,
  CurrentUserClinic,
} from "@/types/contracts/me";

/**
 * `CurrentUser` fixtures for component and unit tests.
 *
 * The per-role capability sets mirror exactly what `me.service.ts` computes
 * for that role (proven against the database by `tests/integration/me.test.ts`).
 * Keeping them here lets the shell, nav filtering, and guard resolvers be
 * tested with no Supabase, no session, and no network.
 */

const DEFAULT_CLINICS: CurrentUserClinic[] = [
  { id: "clinic-north", name: "North Clinic" },
  { id: "clinic-south", name: "South Clinic" },
];

export function makeCurrentUser(
  overrides: Partial<CurrentUser> = {}
): CurrentUser {
  return {
    id: "user-1",
    username: "test.user",
    email: "test.user@example.test",
    fullName: "Test User",
    phone: null,
    role: { name: "ORG_OWNER", displayName: "Owner" },
    group: "org",
    organization: { id: "org-1", name: "Test Organization" },
    capabilities: [...OWNER_CAPABILITIES],
    clinics: DEFAULT_CLINICS,
    ...overrides,
  };
}

const OWNER_CAPABILITIES: Capability[] = [
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
  "compensation:view",
];

/**
 * Admin is Owner minus subscription management and compensation viewing --
 * both Owner-only per UX.md (compensation per D1/ADR-0011).
 */
const ADMIN_CAPABILITIES: Capability[] = OWNER_CAPABILITIES.filter(
  (capability) => capability !== "subscription:manage" && capability !== "compensation:view"
);

const PHYSIO_CAPABILITIES: Capability[] = [
  "patients:view",
  "packages:view",
  "reports:view",
];

const RECEPTION_CAPABILITIES: Capability[] = [
  "patients:view",
  "packages:view",
  "invoices:access",
];

export const currentUserFixtures = {
  owner: () => makeCurrentUser(),

  admin: () =>
    makeCurrentUser({
      id: "user-admin",
      fullName: "Ada Admin",
      role: { name: "ORG_ADMIN", displayName: "Administrator" },
      capabilities: [...ADMIN_CAPABILITIES],
    }),

  physiotherapist: () =>
    makeCurrentUser({
      id: "user-physio",
      fullName: "Priya Physio",
      role: { name: "ORG_PHYSIOTHERAPIST", displayName: "Physiotherapist" },
      capabilities: [...PHYSIO_CAPABILITIES],
      clinics: [DEFAULT_CLINICS[0]],
    }),

  receptionist: () =>
    makeCurrentUser({
      id: "user-reception",
      fullName: "Raj Reception",
      role: { name: "ORG_RECEPTIONIST", displayName: "Receptionist" },
      capabilities: [...RECEPTION_CAPABILITIES],
      clinics: [DEFAULT_CLINICS[0]],
    }),

  superAdmin: () =>
    makeCurrentUser({
      id: "user-super",
      fullName: "Sam Super",
      role: { name: "SUPER_ADMIN", displayName: "Super Admin" },
      group: "platform",
      organization: null,
      capabilities: ["platformApi:explore"],
      clinics: [],
    }),

  /**
   * A platform operational role with no UI in V1 (UX.md). Reaches
   * `/platform/admin` alongside SUPER_ADMIN because the namespace guard is
   * group-level, but holds no capabilities -- this is the fixture that
   * exercises the API Explorer's SUPER_ADMIN-only gate.
   */
  platformSupport: () =>
    makeCurrentUser({
      id: "user-platform-support",
      fullName: "Pat Support",
      role: { name: "PLATFORM_SUPPORT", displayName: "Platform Support" },
      group: "platform",
      organization: null,
      capabilities: [],
      clinics: [],
    }),
} as const;
