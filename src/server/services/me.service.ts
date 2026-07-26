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
  canManageSubscription,
  canViewAuditLogs,
} from "./authorization.service";

/**
 * Maps each contract-owned capability token to the internal authorization
 * predicate that decides it. The token vocabulary is deliberately decoupled
 * from these predicate names -- the wire format (see `CurrentUser`) never
 * exposes them, so predicates can be renamed or recomposed without changing
 * any client.
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
  "subscription:manage": canManageSubscription,
  "auditLogs:view": canViewAuditLogs,
};

/** The set of application roles that belong to the platform namespace. */
function resolveGroup(roleName: string): UserGroup {
  return roleName === "SUPER_ADMIN" || roleName.startsWith("PLATFORM_")
    ? "platform"
    : "org";
}

/**
 * Computes the caller's granted capability tokens by evaluating every
 * predicate in the map and keeping only those that return true.
 */
async function computeCapabilities(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Capability[]> {
  const tokens = Object.keys(CAPABILITY_PREDICATES) as Capability[];
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
 * capabilities remain server-side. Platform users receive no organization
 * capabilities -- their surface is the platform console.
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
    ? await computeCapabilities(supabase, userId)
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
