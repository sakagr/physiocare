import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AppRole } from "../repositories/user.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findAppointmentById } from "../repositories/appointment.repository";
import { findPatientById } from "../repositories/patient.repository";
import { findConsultationById } from "../repositories/consultation.repository";
import { findPrescriptionById } from "../repositories/prescription.repository";
import { findInvoiceById } from "../repositories/invoice.repository";
import { findPaymentById } from "../repositories/payment.repository";
import { findOrganizationById } from "../repositories/organization.repository";
import { findSubscriptionPlanById } from "../repositories/subscription.repository";
import { countClinics } from "../repositories/clinic.repository";
import { countUsers } from "../repositories/user.repository";
import { AppError, ErrorCodes } from "../errors";

/**
 * Centralized mapping of role management administrative capabilities.
 * Defines which roles are authorized to manage which target roles within the same organization.
 */
const ROLE_HIERARCHY: Record<AppRole, AppRole[]> = {
  SUPER_ADMIN: [], // Platform admin has full access bypass and doesn't participate in org hierarchy.
  ORG_OWNER: [
    "ORG_OWNER",
    "ORG_ADMIN",
    "ORG_PHYSIOTHERAPIST",
    "ORG_RECEPTIONIST",
  ],
  ORG_ADMIN: [
    "ORG_PHYSIOTHERAPIST",
    "ORG_RECEPTIONIST",
  ],
  ORG_PHYSIOTHERAPIST: [],
  ORG_RECEPTIONIST: [],
};

/**
 * Helper to determine if a caller role can administer a target role based on the role hierarchy.
 */
export function canManageRole(callerRole: AppRole, targetRole: AppRole): boolean {
  const manageableRoles = ROLE_HIERARCHY[callerRole] || [];
  return manageableRoles.includes(targetRole);
}

/**
 * Resolves the set of roles the caller may assign -- to a newly created user,
 * or as a target role in a role change. Caller-derived only (one lookup),
 * never per-row: `canCreateUser`/`canUpdateUserRole`'s target-role check both
 * reduce to exactly `ROLE_HIERARCHY[callerRole]`, so the same list serves
 * both the create form and the change-role form's role picker.
 */
export async function getAssignableRoles(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<AppRole[]> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return [];

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return [];

  return ROLE_HIERARCHY[roleRecord.name] ?? [];
}

/** Roles authorized for administrative management gates (org-admin tier). */
const ORG_MANAGEMENT_ROLES: AppRole[] = ["ORG_OWNER", "ORG_ADMIN", "SUPER_ADMIN"];

/**
 * Roles authorized to view or set compensation. Narrower than
 * `ORG_MANAGEMENT_ROLES` -- Owner-only (plus the SUPER_ADMIN platform
 * override) on product/privacy grounds: compensation is Owner-scoped
 * per UX.md, not Owner+Admin like general user management.
 */
const COMPENSATION_ROLES: AppRole[] = ["ORG_OWNER", "SUPER_ADMIN"];

/** Roles authorized for front-desk-level management gates (org-admin tier plus receptionist). */
const ORG_FRONT_DESK_ROLES: AppRole[] = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "ORG_RECEPTIONIST",
  "SUPER_ADMIN",
];

/**
 * Resolves the caller's role and checks it against an allowed role set.
 */
async function hasAnyRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  roles: AppRole[]
): Promise<boolean> {
  const caller = await findUserById(supabase, userId);
  if (!caller) return false;
  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  return roles.includes(roleRecord.name);
}

/**
 * Checks whether the caller is an active member of any organization
 * (or the platform SUPER_ADMIN). Used by broad read-access gates whose
 * actual scoping is applied by the calling query itself.
 */
async function isActiveOrgMember(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, userId);
  if (!caller) return false;
  const roleRecord = await findRoleById(supabase, caller.role_id);
  const isSuperAdmin = roleRecord?.name === "SUPER_ADMIN";
  return !!caller.organization_id || isSuperAdmin;
}

/**
 * Verifies if a user has a specific application role.
 */
export async function hasRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: AppRole
): Promise<boolean> {
  const user = await findUserById(supabase, userId);
  if (!user) {
    return false;
  }
  const roleRecord = await findRoleById(supabase, user.role_id);
  if (!roleRecord) {
    return false;
  }
  return roleRecord.name === role;
}

/**
 * Verifies if a user is authorized to bootstrap/create an organization.
 */
export async function canBootstrapOrganization(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  return hasRole(supabase, userId, "SUPER_ADMIN");
}

/**
 * Verifies if a user is authorized to use the platform API explorer
 * (F2). SUPER_ADMIN only, per UX.md -- SUPER_ADMIN is the sole
 * platform-group role in V1; all platform duties are its responsibility.
 */
export async function canExplorePlatformApi(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  return hasRole(supabase, userId, "SUPER_ADMIN");
}

/**
 * Verifies if a user is authorized to create a new user with a specific target role.
 */
export async function canCreateUser(
  supabase: SupabaseClient<Database>,
  creatorUserId: string,
  targetRole: AppRole
): Promise<boolean> {
  const creator = await findUserById(supabase, creatorUserId);
  if (!creator || !creator.organization_id) {
    return false;
  }

  const roleRecord = await findRoleById(supabase, creator.role_id);
  if (!roleRecord) {
    return false;
  }

  const creatorRole = roleRecord.name;

  if (creatorRole === "SUPER_ADMIN") {
    return true;
  }

  if (creatorRole === "ORG_OWNER") {
    return targetRole.startsWith("ORG_");
  }

  if (creatorRole === "ORG_ADMIN") {
    return targetRole.startsWith("ORG_") && targetRole !== "ORG_OWNER" && targetRole !== "ORG_ADMIN";
  }

  return false;
}

/**
 * Checks if a caller has the general privilege to manage organization users.
 */
export async function canManageUsers(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Determines whether a caller can manage (update profile, deactivate, activate, off-board) a target user.
 */
export async function canManageTargetUser(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  const target = await findUserById(supabase, targetUserId);
  if (!caller || !target) return false;

  const callerRoleRecord = await findRoleById(supabase, caller.role_id);
  if (!callerRoleRecord) return false;

  // Platform SUPER_ADMIN has global override authority
  if (callerRoleRecord.name === "SUPER_ADMIN") {
    return true;
  }

  // Enforce same-organization scoping
  if (!caller.organization_id || caller.organization_id !== target.organization_id) {
    return false;
  }

  const targetRoleRecord = await findRoleById(supabase, target.role_id);
  if (!targetRoleRecord) return false;

  return canManageRole(callerRoleRecord.name, targetRoleRecord.name);
}

/**
 * Checks if a caller is authorized to change a user's role.
 */
export async function canUpdateUserRole(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string,
  targetRole: AppRole
): Promise<boolean> {
  const canManageTarget = await canManageTargetUser(supabase, callerUserId, targetUserId);
  if (!canManageTarget) return false;

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const callerRoleRecord = await findRoleById(supabase, caller.role_id);
  if (!callerRoleRecord) return false;

  if (callerRoleRecord.name === "SUPER_ADMIN") return true;

  // Caller must be authorized to assign the target role as well
  return canManageRole(callerRoleRecord.name, targetRole);
}

/**
 * Checks if a caller has write administration access over clinics.
 */
export async function canManageClinics(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller has read access over clinics.
 */
export async function canViewClinics(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  // Any active organization employee or platform super admin can view clinics
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller has read access to packages.
 * Packages are organization-owned entities: any active organization member
 * (regardless of clinic assignment) may view them.
 */
export async function canViewPackages(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller has write access over the package catalog.
 * A pricing/session catalog is admin-owned, same tier as canManageClinics.
 */
export async function canManagePackages(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller has read access to patient packages.
 * Patient packages are organization-owned entities: any active organization
 * member may view them (packages themselves are org-wide, not clinic-scoped).
 */
export async function canViewPatientPackages(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller has write access over patient package assignments.
 */
export async function canManagePatientPackages(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_FRONT_DESK_ROLES);
}

/**
 * Checks if a caller may correct a package session usage record (soft-delete
 * a wrongly-recorded consumption). Narrower than general patient-package
 * management -- excludes ORG_RECEPTIONIST, matching the RLS delete policy
 * on package_session_usage.
 */
export async function canCorrectPackageSessionUsage(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller may set or update a user's compensation record.
 * ORG_OWNER only (plus SUPER_ADMIN) -- narrowed from the general
 * ORG_MANAGEMENT_ROLES tier per UX.md's Owner-only scoping of compensation
 * (ADR-0011). The RLS insert/update policies on user_compensations remain
 * permissive (ORG_OWNER/ORG_ADMIN) as a backstop; this predicate, not RLS,
 * is where the Owner-only boundary is enforced.
 */
export async function canManageCompensation(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, COMPENSATION_ROLES);
}

/**
 * Checks if a caller may view a user's compensation record/history.
 * Same role set as `canManageCompensation` (ADR-0011) -- the RLS SELECT
 * policy on user_compensations stays permissive to ORG_OWNER/ORG_ADMIN
 * (do not narrow it: getCommissionReport reads through it under an Admin's
 * own session, and RLS filters silently rather than erroring, so tightening
 * it would make Admin-run commission reports report zero commission with
 * no error).
 */
export async function canViewCompensation(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, COMPENSATION_ROLES);
}

/**
 * Checks if an organization is currently allowed to perform a write
 * operation ("use the product"): its operational status is active, and its
 * subscription is trialing, active, or past_due (a past_due subscription
 * retains access for a grace period -- see Subscription Renewal Workflow).
 * Not role-based -- this gates the organization itself, independent of who
 * the caller is.
 */
export async function canOrganizationTransact(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<boolean> {
  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    return false;
  }
  return organization.status === "active" && ["trialing", "active", "past_due"].includes(organization.subscription_status);
}

/**
 * Throwing form of canOrganizationTransact, used by every gated write path
 * (see AGENTS.md "Subscription Principles" -> "The write/read boundary").
 * The rule covers ~40 call sites; they share one helper so the error code
 * and message cannot drift between them.
 *
 * The only function in this module that throws rather than returning a
 * boolean -- deliberate, since the alternative is 40 hand-copied throw
 * blocks. The predicate itself stays exported and unchanged.
 */
export async function assertOrganizationCanTransact(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<void> {
  if (!(await canOrganizationTransact(supabase, organizationId))) {
    throw new AppError("Organization does not have an active subscription", ErrorCodes.SUBSCRIPTION_REQUIRED);
  }
}

/**
 * Checks if a caller may select a subscription plan for an organization.
 * ORG_OWNER may select for their own organization (self-service); SUPER_ADMIN
 * may select on behalf of any organization. The service layer enforces which
 * organization a non-platform caller may target.
 */
export async function canManageSubscription(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ["ORG_OWNER", "SUPER_ADMIN"]);
}

/**
 * Checks if a caller may activate or renew an organization's subscription.
 * SUPER_ADMIN only -- never self-service (no payment automation exists in
 * this codebase yet).
 */
export async function canActivateSubscription(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasRole(supabase, callerUserId, "SUPER_ADMIN");
}

/**
 * Checks if an organization has room under its subscription plan's
 * max_clinics to create one more clinic. Not role-based -- gates the
 * organization's plan ceiling, independent of who the caller is. Every
 * organization always has a real plan (NO_SUBSCRIPTION at minimum), so
 * there is no null-plan case to special-case.
 */
export async function canCreateClinicWithinLimit(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<boolean> {
  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    return false;
  }
  const plan = await findSubscriptionPlanById(supabase, organization.subscription_plan_id);
  if (!plan) {
    return false;
  }
  const clinicCount = await countClinics(supabase, organizationId, {});
  return clinicCount < plan.max_clinics;
}

/**
 * Checks if an organization has room under its subscription plan's
 * max_users to create one more user.
 */
export async function canCreateUserWithinLimit(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<boolean> {
  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    return false;
  }
  const plan = await findSubscriptionPlanById(supabase, organization.subscription_plan_id);
  if (!plan) {
    return false;
  }
  const userCount = await countUsers(supabase, organizationId, {});
  return userCount < plan.max_users;
}

/**
 * Checks if a caller has read access to invoices (broad gate; actual scoping
 * is applied by the listing query itself, see invoice.service.ts).
 */
export async function canViewInvoices(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller is authorized to create or edit invoices.
 */
export async function canManageInvoices(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_FRONT_DESK_ROLES);
}

/**
 * Checks if a caller may view or update a specific invoice.
 * - ORG_OWNER/ORG_ADMIN: any invoice within their organization.
 * - ORG_RECEPTIONIST: invoices at a clinic they are assigned to.
 * - ORG_PHYSIOTHERAPIST: only invoices tied to their own appointments.
 */
export async function canAccessInvoice(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  invoiceId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const invoice = await findInvoiceById(supabase, invoiceId);
  if (!invoice || invoice.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;

  if (roleRecord.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    return accessibleClinicIds.includes(invoice.clinic_id);
  }

  if (roleRecord.name === "ORG_PHYSIOTHERAPIST" && invoice.appointment_id) {
    const appointment = await findAppointmentById(supabase, invoice.appointment_id);
    return appointment?.physiotherapist_id === callerUserId;
  }

  return false;
}

/**
 * Checks if a caller has read access to payments (broad gate; actual scoping
 * is applied by the listing query itself, see payment.service.ts).
 */
export async function canViewPayments(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller is authorized to record a payment against an invoice.
 */
export async function canManagePayments(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_FRONT_DESK_ROLES);
}

/**
 * Checks if a caller is authorized to transition a payment's status
 * (refund/cancel). Administrative only -- not front-desk.
 */
export async function canUpdatePaymentStatus(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller is authorized to (hard-scope) cancel/delete an invoice.
 * Administrative correction path, allowed regardless of payment state.
 */
export async function canDeleteInvoice(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller may view or update a specific payment (same scoping as
 * canAccessInvoice, evaluated against the payment's invoice).
 */
export async function canAccessPayment(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  paymentId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const payment = await findPaymentById(supabase, paymentId);
  if (!payment || payment.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;

  const invoice = await findInvoiceById(supabase, payment.invoice_id);
  if (!invoice) return false;

  if (roleRecord.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    return accessibleClinicIds.includes(invoice.clinic_id);
  }

  if (roleRecord.name === "ORG_PHYSIOTHERAPIST" && invoice.appointment_id) {
    const appointment = await findAppointmentById(supabase, invoice.appointment_id);
    return appointment?.physiotherapist_id === callerUserId;
  }

  return false;
}

/**
 * Checks if a caller has read access to attendance (broad gate; actual
 * scoping -- self/accessible-clinics/org-wide -- is applied by the listing
 * query itself, see attendance.service.ts).
 */
export async function canViewAttendance(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller is authorized to record or correct attendance for
 * someone else. Any active org member may still record their own (see
 * canRecordOwnAttendance).
 */
export async function canManageAttendance(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_FRONT_DESK_ROLES);
}

/**
 * Checks if a caller may record their own attendance (any active org member).
 */
export async function canRecordOwnAttendance(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;
  return !!caller.organization_id;
}

/**
 * Checks if a caller may view a specific notification: its own (as the
 * user recipient), or any organization notification for ORG_OWNER/ORG_ADMIN.
 */
export async function canViewNotification(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  notification: { organization_id: string; user_id: string | null }
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (roleRecord?.name === "SUPER_ADMIN") return true;

  if (caller.organization_id !== notification.organization_id) return false;
  if (roleRecord?.name === "ORG_OWNER" || roleRecord?.name === "ORG_ADMIN") return true;

  return notification.user_id === callerUserId;
}

/**
 * Checks if a caller is authorized to create notification records.
 */
export async function canManageNotifications(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller is authorized to view the organization's audit trail.
 */
export async function canViewAuditLogs(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller is authorized to assign or remove clinic assignments.
 */
export async function canAssignUserToClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return canManageClinics(supabase, callerUserId);
}

/**
 * Checks if a caller is authorized to view user clinic assignments.
 */
export async function canViewUserClinicAssignments(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return canViewClinics(supabase, callerUserId);
}

/**
 * Checks if a caller has read access to patients.
 * Patients are organization-owned entities: any active organization member
 * (regardless of clinic assignment) may view and search them.
 */
export async function canViewPatients(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller has write access over patient demographic records.
 */
export async function canManagePatients(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_FRONT_DESK_ROLES);
}

/**
 * Resolves all clinic IDs accessible to the user.
 * - Platform admins (SUPER_ADMIN) and organization admins (ORG_OWNER, ORG_ADMIN) can access all clinics in the organization.
 * - Regular clinic employees are restricted to their explicitly assigned clinics.
 */
export async function getAccessibleClinicIds(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string[]> {
  const user = await findUserById(supabase, userId);
  if (!user) {
    return [];
  }

  const roleRecord = await findRoleById(supabase, user.role_id);
  if (!roleRecord) {
    return [];
  }

  const roleName = roleRecord.name;

  if (roleName === "SUPER_ADMIN") {
    const { data, error } = await supabase
      .from("clinics")
      .select("id")
      .is("deleted_at", null);
    if (error) throw error;
    return data.map((c) => c.id);
  }

  if (roleName === "ORG_OWNER" || roleName === "ORG_ADMIN") {
    if (!user.organization_id) return [];
    const { data, error } = await supabase
      .from("clinics")
      .select("id")
      .eq("organization_id", user.organization_id)
      .is("deleted_at", null);
    if (error) throw error;
    return data.map((c) => c.id);
  }

  // Non-managerial role: Query active assignments in user_clinics
  const { data, error } = await supabase
    .from("user_clinics")
    .select("clinic_id")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) throw error;
  return data.map((uc) => uc.clinic_id);
}

/**
 * Checks if a caller may view a patient's uploaded records.
 * - ORG_OWNER/ORG_ADMIN: any patient within their organization.
 * - ORG_RECEPTIONIST: patients with an appointment at an accessible clinic.
 * - ORG_PHYSIOTHERAPIST: patients they have an appointment with.
 * - Other roles: no access.
 */
export async function canViewPatientRecords(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const patient = await findPatientById(supabase, patientId);
  if (!patient || patient.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;

  const { data, error } = await supabase
    .from("appointments")
    .select("clinic_id, physiotherapist_id")
    .eq("patient_id", patientId)
    .is("deleted_at", null);
  if (error) throw error;

  if (roleRecord.name === "ORG_PHYSIOTHERAPIST") {
    return data.some((appointment) => appointment.physiotherapist_id === callerUserId);
  }

  if (roleRecord.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    return data.some((appointment) => accessibleClinicIds.includes(appointment.clinic_id));
  }

  return false;
}

/**
 * Checks if a caller may upload records for a patient. Scoping is identical
 * to canViewPatientRecords.
 */
export async function canManagePatientRecords(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string
): Promise<boolean> {
  return canViewPatientRecords(supabase, callerUserId, patientId);
}

/**
 * Checks if a caller has read access to appointments (broad gate; actual
 * scoping is applied by the listing query itself, see appointment.service.ts).
 */
export async function canViewAppointments(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller is authorized to create appointments.
 */
export async function canManageAppointments(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_FRONT_DESK_ROLES);
}

/**
 * Checks if a caller may view or update a specific appointment.
 * - ORG_OWNER/ORG_ADMIN: any appointment within their organization.
 * - ORG_RECEPTIONIST: appointments at a clinic they are assigned to.
 * - ORG_PHYSIOTHERAPIST: only their own appointments.
 */
export async function canAccessAppointment(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const appointment = await findAppointmentById(supabase, appointmentId);
  if (!appointment || appointment.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;

  if (appointment.physiotherapist_id === callerUserId) return true;

  if (roleRecord.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    return accessibleClinicIds.includes(appointment.clinic_id);
  }

  return false;
}

/**
 * Checks if a caller has read access to consultations (broad gate; actual
 * scoping is applied by the listing query itself).
 */
export async function canViewConsultations(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller may create or update the consultation for an
 * appointment: the appointment's own physiotherapist, or ORG_OWNER/ORG_ADMIN.
 */
export async function canManageConsultation(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const appointment = await findAppointmentById(supabase, appointmentId);
  if (!appointment || appointment.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;

  return appointment.physiotherapist_id === callerUserId;
}

/**
 * Checks if a caller may view a specific consultation.
 * - ORG_OWNER/ORG_ADMIN: any consultation within their organization.
 * - ORG_RECEPTIONIST: consultations whose appointment is at an accessible clinic.
 * - ORG_PHYSIOTHERAPIST: only their own consultations.
 */
export async function canAccessConsultation(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  consultationId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const consultation = await findConsultationById(supabase, consultationId);
  if (!consultation || consultation.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;
  if (consultation.physiotherapist_id === callerUserId) return true;

  if (roleRecord.name === "ORG_RECEPTIONIST") {
    const appointment = await findAppointmentById(supabase, consultation.appointment_id);
    if (!appointment) return false;
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    return accessibleClinicIds.includes(appointment.clinic_id);
  }

  return false;
}

/**
 * Checks if a caller has read access to prescriptions (broad gate; actual
 * scoping is applied by the listing query itself).
 */
export async function canViewPrescriptions(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller may create or update the prescriptions for a
 * consultation: the consultation's own physiotherapist, or ORG_OWNER/ORG_ADMIN.
 */
export async function canManagePrescription(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  consultationId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const consultation = await findConsultationById(supabase, consultationId);
  if (!consultation || consultation.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;

  return consultation.physiotherapist_id === callerUserId;
}

/**
 * Checks if a caller may view a specific prescription.
 * - ORG_OWNER/ORG_ADMIN: any prescription within their organization.
 * - ORG_RECEPTIONIST: prescriptions whose consultation's appointment is at an accessible clinic.
 * - ORG_PHYSIOTHERAPIST: only their own prescriptions.
 */
export async function canAccessPrescription(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  prescriptionId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  if (roleRecord.name === "SUPER_ADMIN") return true;

  const prescription = await findPrescriptionById(supabase, prescriptionId);
  if (!prescription || prescription.organization_id !== caller.organization_id) return false;

  if (roleRecord.name === "ORG_OWNER" || roleRecord.name === "ORG_ADMIN") return true;
  if (prescription.physiotherapist_id === callerUserId) return true;

  if (roleRecord.name === "ORG_RECEPTIONIST") {
    const consultation = await findConsultationById(supabase, prescription.consultation_id);
    if (!consultation) return false;
    const appointment = await findAppointmentById(supabase, consultation.appointment_id);
    if (!appointment) return false;
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    return accessibleClinicIds.includes(appointment.clinic_id);
  }

  return false;
}

/**
 * Checks if a caller has read access to the billing report (broad gate;
 * actual clinic/role scoping is applied by billing-report.service.ts,
 * mirroring listOrganizationInvoices).
 */
export async function canViewBillingReports(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller has read access to the physiotherapist report (broad
 * gate; actual role/self scoping is applied by physiotherapist-report.service.ts).
 */
export async function canViewPhysiotherapistReports(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return isActiveOrgMember(supabase, callerUserId);
}

/**
 * Checks if a caller is authorized to (hard-scope) delete an appointment.
 * This is an administrative correction path, distinct from the
 * status = 'cancelled' business state; organization scoping is enforced
 * separately by the caller (see appointment.service.ts).
 */
export async function canDeleteAppointment(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller may open the Appointments oversight destination.
 * This is the managerial cross-staff/clinic review surface (Owner/Admin) --
 * distinct from `canManageAppointments` (front desk, includes reception) and
 * `canViewAppointments` (any member); daily operational appointment access
 * runs through the dashboard, not this destination.
 */
export async function canOverseeAppointments(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller may open the Attendance board destination (managerial
 * review of staff attendance across the organization). Distinct from
 * recording attendance, which any member may do for themselves and front
 * desk may do for others.
 */
export async function canOverseeAttendance(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller may open Organization Settings (organization profile).
 * Owner/Admin tier -- gates *opening* the destination only. The Subscription
 * tab within Settings is further gated by `canManageSubscription`
 * (ORG_OWNER/SUPER_ADMIN), and editing the profile fields themselves by the
 * narrower `canUpdateOrganizationProfile` (ORG_OWNER/SUPER_ADMIN) -- ORG_ADMIN
 * opens Settings but sees a read-only profile form and no Subscription tab.
 */
export async function canManageOrganizationSettings(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ORG_MANAGEMENT_ROLES);
}

/**
 * Checks if a caller may edit the organization profile (name, default
 * currency). Deliberately narrower than `canManageOrganizationSettings`
 * (which also admits ORG_ADMIN and only gates opening the Settings
 * destination) -- ORG_ADMIN sees a read-only profile form. Matches
 * `organizations_update_policy`, which already admits exactly ORG_OWNER and
 * SUPER_ADMIN.
 */
export async function canUpdateOrganizationProfile(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, ["ORG_OWNER", "SUPER_ADMIN"]);
}

/**
 * Checks if a caller may open the Reports destination. Owner/Admin see all
 * report tabs; a physiotherapist sees only their own physiotherapist report.
 * Reception has no reports access. Per-tab and per-row scoping is applied by
 * the report services themselves.
 */
export async function canViewReports(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return hasAnyRole(supabase, callerUserId, [
    ...ORG_MANAGEMENT_ROLES,
    "ORG_PHYSIOTHERAPIST",
  ]);
}
