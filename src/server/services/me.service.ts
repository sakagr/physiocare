import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  Capability,
  CurrentUser,
  CurrentUserClinic,
  UserGroup,
} from "@/types/contracts/me";
import { findUserWithRoleById } from "../repositories/user.repository";
import { findOrganizationById } from "../repositories/organization.repository";
import { listClinics } from "../repositories/clinic.repository";
import { listClinicsByUser } from "../repositories/user-clinic.repository";
import { AppError, ErrorCodes } from "../errors";
import {
  canViewPatients,
  canOverseeAppointments,
  canOverseeAttendance,
  canManageInvoices,
  canViewPackages,
  canViewReports,
  canManageUsers,
  canManageClinics,
  canManageOrganizationSettings,
  canUpdateOrganizationProfile,
  canManageSubscription,
  canViewAuditLogs,
  canExplorePlatformApi,
  canViewCompensation,
} from "./authorization.service";

/**
 * Maps each contract-owned capability token to the internal authorization
 * predicate that decides it. The token vocabulary is deliberately decoupled
 * from these predicate names -- the wire format (see `CurrentUser`) never
 * exposes them, so predicates can be renamed or recomposed without changing
 * any client. Total over `Capability`, so a token with no predicate is a
 * compile error rather than a silent gap.
 */
const CAPABILITY_PREDICATES: Record<
  Capability,
  (supabase: SupabaseClient<Database>, userId: string) => Promise<boolean>
> = {
  "patients:view": canViewPatients,
  "appointments:oversee": canOverseeAppointments,
  "attendance:oversee": canOverseeAttendance,
  "invoices:access": canManageInvoices,
  "packages:view": canViewPackages,
  "reports:view": canViewReports,
  "users:manage": canManageUsers,
  "clinics:manage": canManageClinics,
  "settings:manage": canManageOrganizationSettings,
  "organization:manage": canUpdateOrganizationProfile,
  "subscription:manage": canManageSubscription,
  "auditLogs:view": canViewAuditLogs,
  "platformApi:explore": canExplorePlatformApi,
  "compensation:view": canViewCompensation,
};

/**
 * The capability tokens evaluated for an organization user. Kept as its own
 * vocabulary, rather than every caller getting every token evaluated,
 * because a token's meaning is group-specific: `platformApi:explore` is
 * nonsensical for an org user and would be `false` for all of them,
 * publishing a phantom "not granted" entry that invites confusion about
 * whether it was ever considered.
 */
export const ORG_CAPABILITIES: readonly Capability[] = [
  "patients:view",
  "appointments:oversee",
  "attendance:oversee",
  "invoices:access",
  "packages:view",
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
 * The capability tokens evaluated for a platform user. Previously platform
 * users received an unconditionally empty capability array -- correct while
 * no platform capability existed, but it made one inexpressible without this
 * restructure (F2, ADR-0009).
 */
export const PLATFORM_CAPABILITIES: readonly Capability[] = [
  "platformApi:explore",
];

/** The set of application roles that belong to the platform namespace. */
function resolveGroup(roleName: string): UserGroup {
  return roleName === "SUPER_ADMIN" ? "platform" : "org";
}

/**
 * Computes the caller's granted capability tokens by evaluating every
 * predicate for the given vocabulary and keeping only those that return
 * true. The vocabulary is the caller's group's token set (`ORG_CAPABILITIES`
 * or `PLATFORM_CAPABILITIES`), not the full `Capability` union -- a token
 * outside the caller's group is never evaluated, not evaluated-and-denied.
 */
async function computeCapabilities(
  supabase: SupabaseClient<Database>,
  userId: string,
  tokens: readonly Capability[]
): Promise<Capability[]> {
  const grants = await Promise.all(
    tokens.map((token) => CAPABILITY_PREDICATES[token](supabase, userId))
  );
  return tokens.filter((_, index) => grants[index]);
}

/**
 * The clinic switcher is a bounded picker, not a browsable collection, so a
 * single generously-sized page is fetched rather than paginating the
 * contract. Organizations are capped well below this by their plan's
 * `max_clinics`.
 */
const CLINIC_PICKER_LIMIT = 200;

/**
 * Resolves the clinics the caller may work in. The management tier works
 * across the whole organization; everyone else is limited to the clinics
 * they are assigned to.
 */
async function resolveAccessibleClinics(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string
): Promise<CurrentUserClinic[]> {
  const managesClinics = await canManageClinics(supabase, userId);

  const clinics = managesClinics
    ? await listClinics(supabase, organizationId, {
        page: 1,
        limit: CLINIC_PICKER_LIMIT,
        isActive: true,
      })
    : await listClinicsByUser(supabase, organizationId, userId);

  return clinics
    .filter((clinic) => clinic.is_active)
    .map((clinic) => ({ id: clinic.id, name: clinic.clinic_name }));
}

/**
 * Resolves the current user's identity, role, group, organization context,
 * and coarse capability map for `GET /api/users/me`. Read-only query.
 *
 * Capabilities are the navigation/coarse set only; contextual per-item
 * capabilities remain server-side. Platform users are evaluated against
 * `PLATFORM_CAPABILITIES`, never `ORG_CAPABILITIES` -- their surface is the
 * platform console, not an organization.
 */
export async function getCurrentUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CurrentUser> {
  const user = await findUserWithRoleById(supabase, userId);
  if (!user) {
    throw new AppError("User profile not found", ErrorCodes.NOT_FOUND);
  }

  const group = resolveGroup(user.role.name);

  let organization: CurrentUser["organization"] = null;
  if (user.organization_id) {
    const org = await findOrganizationById(supabase, user.organization_id);
    if (org) {
      organization = { id: org.id, name: org.organization_name };
    }
  }

  const isOrgUser = group === "org" && Boolean(user.organization_id);
  const capabilities = isOrgUser
    ? await computeCapabilities(supabase, userId, ORG_CAPABILITIES)
    : group === "platform"
      ? await computeCapabilities(supabase, userId, PLATFORM_CAPABILITIES)
      : [];
  const clinics = isOrgUser
    ? await resolveAccessibleClinics(supabase, userId, user.organization_id!)
    : [];

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    role: { name: user.role.name, displayName: user.role.display_name },
    group,
    organization,
    capabilities,
    clinics,
  };
}
