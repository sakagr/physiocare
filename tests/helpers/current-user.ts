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
  "compensation:view",
];

/**
 * Admin is Owner minus subscription management, organization-profile editing,
 * and compensation viewing -- all Owner-only (subscription/profile per F4
 * decision 4/M0-B, compensation per D1/ADR-0011).
 */
const ADMIN_CAPABILITIES: Capability[] = OWNER_CAPABILITIES.filter(
  (capability) =>
    capability !== "subscription:manage" &&
    capability !== "organization:manage" &&
    capability !== "compensation:view"
);

/**
 * `attendance:record` (F6) is what gives a physiotherapist Flow 14: marking
 * themselves unavailable. It does **not** imply `attendance:manage` -- the two
 * cross rather than nest (D11), and a physiotherapist never records another
 * person's attendance.
 */
const PHYSIO_CAPABILITIES: Capability[] = [
  "patients:view",
  "packages:view",
  "reports:view",
  "attendance:record",
];

/**
 * Reception may manage patients and their package assignments (both
 * ORG_FRONT_DESK_ROLES) but not the catalogue (ORG_MANAGEMENT_ROLES), and may
 * not delete a patient record -- the deliberate asymmetry against being able
 * to upload one.
 *
 * `attendance:manage` without `attendance:record` is the other half of F6's
 * crossing (D11): reception records attendance *for other staff* and never
 * their own. `UX.md`'s Screen Inventory previously said Owner/Admin only,
 * contradicting Flow 14, which already assigned this to the
 * attendance-management capability; Flow 14 was the correct side.
 */
const RECEPTION_CAPABILITIES: Capability[] = [
  "patients:view",
  "patients:manage",
  "packages:view",
  "patientPackages:manage",
  "invoices:access",
  "appointments:manage",
  "attendance:manage",
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
} as const;
