import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { PASSWORD_SETUP_PATHS } from "@/lib/auth/password-setup-ticket";
import { getAuthCallbackUrl } from "../config/site-url";
import { validateCreateOrganizationInput } from "../validators/organization.validator";
import type { CreateOrganizationInput } from "../validators/organization.validator";
import type { CreateOrganizationUserInput } from "../validators/user.validator";
import {
  findOrganizationByName,
  findOrganizationById,
  insertOrganization,
  updateOrganizationCreatedBy,
  updateOrganizationProfile as updateOrganizationProfileInternal,
  updateOrganizationStatus,
} from "../repositories/organization.repository";
import type { Organization } from "../repositories/organization.repository";
import type { UpdateOrganizationProfileInput } from "../validators/organization.validator";
import { findSubscriptionPlanByName, findSubscriptionPlanById } from "../repositories/subscription.repository";
import { inviteUser, deleteUser, generateInitialPassword, createAuthUser, setUserDisabled, setUserEnabled, setUserPassword } from "./auth.service";
import type { AppRole, UpdateUser, User } from "../repositories/user.repository";
import { findUserById, updateUser, findRoleByName, countUsers } from "../repositories/user.repository";
import {
  createOrganizationOwner,
  ensureUsernameAvailable,
  ensureEmailAvailable,
  createOrganizationUserProfile,
} from "./user.service";
import { AppError, ErrorCodes } from "../errors";
import {
  canManageTargetUser,
  canUpdateUserRole,
  canManageClinics,
  canAssignUserToClinic,
  assertOrganizationCanTransact,
  canCreateClinicWithinLimit,
  canCreateUserWithinLimit,
  canUpdateOrganizationProfile as canUpdateOrganizationProfilePredicate,
  canManageOrganizationSettings,
  canManageSubscription,
} from "./authorization.service";
import { recordAuditLog } from "./audit-log.service";
import type { CreateClinicInput, UpdateClinicInput } from "../validators/clinic.validator";
import { findClinicByNameInOrg, findClinicById, countClinics, type Clinic } from "../repositories/clinic.repository";
import { createClinicInternal, updateClinicInternal } from "./clinic.service";
import type { UserClinic } from "../repositories/user-clinic.repository";
import { upsertAssignmentInternal, deleteAssignmentInternal } from "./user-clinic.service";

/**
 * Result returned after successfully bootstrapping an organization.
 */
export interface BootstrapOrganizationResult {
  organizationId: string;
  adminUserId: string;
  adminUsername: string;
}

/**
 * Bootstraps a new organization and its initial administrator.
 */
export async function bootstrapOrganization(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  input: CreateOrganizationInput
): Promise<BootstrapOrganizationResult> {
  // 1. Validate the input
  const validatedInput = validateCreateOrganizationInput(input);

  // 2. Verify that the organization name does not already exist
  const existingOrg = await findOrganizationByName(supabase, validatedInput.organizationName);
  if (existingOrg) {
    throw new AppError(
      `Organization name "${validatedInput.organizationName}" already exists`,
      ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS
    );
  }

  // 3. Verify that the administrator email does not already exist
  await ensureEmailAvailable(supabase, validatedInput.adminEmail);

  // 3b. Verify that the administrator username does not already exist
  await ensureUsernameAvailable(supabase, validatedInput.adminUsername);

  // 4. Invite the administrator using the Auth Service
  // The invitation returns the owner to the session handoff, which forwards
  // them to the set-password screen. Without a redirect target they would
  // land in the app having never chosen a password.
  const authUser = await inviteUser(
    adminClient,
    validatedInput.adminEmail,
    getAuthCallbackUrl(PASSWORD_SETUP_PATHS.invite)
  );

  // 4b. Resolve the NO_SUBSCRIPTION system plan. Onboarding still contains
  // no billing/subscription logic (Subscription Principles, AGENTS.md) --
  // this is a fixed reference row, not a business decision made here.
  const noSubscriptionPlan = await findSubscriptionPlanByName(supabase, "NO_SUBSCRIPTION");
  if (!noSubscriptionPlan) {
    throw new Error("NO_SUBSCRIPTION system plan is missing; check that migrations have run");
  }

  try {
    // 5. Create the organization with status = "draft"
    const organization = await insertOrganization(supabase, {
      organization_name: validatedInput.organizationName,
      status: "draft",
      subscription_plan_id: noSubscriptionPlan.id,
    });

    // 6. Create the initial organization owner using the User Service
    const ownerUser = await createOrganizationOwner(supabase, {
      authUserId: authUser.id,
      organizationId: organization.id,
      fullName: validatedInput.adminFullName,
      email: validatedInput.adminEmail,
      username: validatedInput.adminUsername,
    });

    // 7. Update organizations.created_by
    await updateOrganizationCreatedBy(supabase, organization.id, ownerUser.id);

    // 8. Update the organization status to "active"
    await updateOrganizationStatus(supabase, organization.id, "active");

    // 9. Return result
    return {
      organizationId: organization.id,
      adminUserId: ownerUser.id,
      adminUsername: ownerUser.username,
    };
  } catch (error) {
    // Rollback strategy: delete the invited auth user if database operations fail
    try {
      await deleteUser(adminClient, authUser.id);
    } catch {
      //TODO: Introduce centralized monitoring/alerting for compensation failures.
    }
    // Rethrow original exception
    throw error;
  }
}

export interface CreateOrganizationUserResult {
  userId: string;
  username: string;
  initialPassword?: string;
}

export interface OrganizationDetailSubscription {
  planId: string;
  planName: string;
  status: Database["public"]["Enums"]["subscription_status"];
  startsAt: string | null;
  endsAt: string | null;
  usage: {
    clinics: { used: number; max: number };
    users: { used: number; max: number };
  };
}

export interface OrganizationDetail {
  id: string;
  organizationName: string;
  defaultCurrencyCode: string | null;
  status: Database["public"]["Enums"]["organization_status"];
  createdAt: string;
  updatedAt: string;
  /**
   * null for a caller who may open Settings (`canManageOrganizationSettings`)
   * but not manage the subscription (`canManageSubscription`) -- ORG_ADMIN
   * sees the Organization tab only, per UX.md's Owner/SUPER_ADMIN-only
   * Subscription tab. Projected in the response rather than a second
   * endpoint/predicate pair.
   */
  subscription: OrganizationDetailSubscription | null;
}

/**
 * Reads an organization's profile, plus its subscription/usage snapshot
 * when the caller is also authorized to manage the subscription.
 */
export async function getOrganizationDetail(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  organizationId: string
): Promise<OrganizationDetail> {
  const isAuthorized = await canManageOrganizationSettings(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    throw new AppError("Organization not found", ErrorCodes.NOT_FOUND);
  }

  if (caller.organization_id !== null && caller.organization_id !== organizationId) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  let subscription: OrganizationDetailSubscription | null = null;
  const canSeeSubscription = await canManageSubscription(supabase, callerUserId);
  if (canSeeSubscription) {
    const plan = await findSubscriptionPlanById(supabase, organization.subscription_plan_id);
    if (!plan) {
      throw new Error("Organization references a subscription plan that no longer exists");
    }

    const [clinicsUsed, usersUsed] = await Promise.all([
      countClinics(supabase, organizationId, {}),
      countUsers(supabase, organizationId, {}),
    ]);

    subscription = {
      planId: plan.id,
      planName: plan.plan_name,
      status: organization.subscription_status,
      startsAt: organization.subscription_starts_at,
      endsAt: organization.subscription_ends_at,
      usage: {
        clinics: { used: clinicsUsed, max: plan.max_clinics },
        users: { used: usersUsed, max: plan.max_users },
      },
    };
  }

  return {
    id: organization.id,
    organizationName: organization.organization_name,
    defaultCurrencyCode: organization.default_currency_code,
    status: organization.status,
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
    subscription,
  };
}

/**
 * Updates an organization's profile (name, default currency). Scoped to
 * these two fields only -- subscription fields go through
 * subscription.service.ts's own workflow, never this path.
 */
export async function updateOrganizationProfile(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  organizationId: string,
  input: UpdateOrganizationProfileInput
): Promise<Organization> {
  const isAuthorized = await canUpdateOrganizationProfilePredicate(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    throw new AppError("Organization not found", ErrorCodes.NOT_FOUND);
  }

  if (caller.organization_id !== null && caller.organization_id !== organizationId) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const updated = await updateOrganizationProfileInternal(supabase, organizationId, {
    organization_name: input.organizationName,
    default_currency_code: input.defaultCurrencyCode,
  });

  await recordAuditLog(supabase, {
    organizationId,
    userId: caller.organization_id === organizationId ? callerUserId : null,
    action: "organization_profile_updated",
    entityName: "organizations",
    entityId: organizationId,
    oldData: { organization_name: organization.organization_name, default_currency_code: organization.default_currency_code },
    newData: { organization_name: updated.organization_name, default_currency_code: updated.default_currency_code },
  });

  return updated;
}

/**
 * Orchestrates the onboarding flow for a new organization user.
 *
 * Flow:
 * 1. Resolves the creator profile to get their organization ID and verify non-null.
 * 2. Checks username and email availability.
 * 3. Generates a secure initial password.
 * 4. Provisions the user in Supabase Auth.
 * 5. Creates the application user profile.
 * 6. Rollback: deletes the Supabase Auth user if profile creation fails.
 */
export async function createOrganizationUser(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  creatorUserId: string,
  input: CreateOrganizationUserInput
): Promise<CreateOrganizationUserResult> {
  // 1. Resolve creator profile
  const creator = await findUserById(supabase, creatorUserId);
  if (!creator || !creator.organization_id) {
    throw new Error("Creator must belong to a valid organization");
  }

  const organizationId = creator.organization_id;

  await assertOrganizationCanTransact(supabase, organizationId);

  const isWithinUserLimit = await canCreateUserWithinLimit(supabase, organizationId);
  if (!isWithinUserLimit) {
    throw new AppError("Organization has reached its subscription plan's user limit", ErrorCodes.ORGANIZATION_LIMIT_EXCEEDED);
  }

  // 2. Perform duplicate checks
  await ensureUsernameAvailable(supabase, input.username);
  await ensureEmailAvailable(supabase, input.email);

  // 3. Generate initial password
  const initialPassword = generateInitialPassword();

  // 4. Create the Supabase Auth user identity
  const authUser = await createAuthUser(adminClient, input.email, initialPassword);

  try {
    // 5. Create the database user profile
    const userProfile = await createOrganizationUserProfile(supabase, {
      authUserId: authUser.id,
      organizationId,
      fullName: input.fullName,
      email: input.email,
      username: input.username,
      roleName: input.role,
      phone: input.phone,
    });

    // TODO: Integrate audit logging when the Audit module is implemented.

    return {
      userId: userProfile.id,
      username: userProfile.username,
      initialPassword,
    };
  } catch (error) {
    // Rollback: delete the created auth user
    try {
      await deleteUser(adminClient, authUser.id);
    } catch {
      // Centralized monitoring / alerting for compensation failures in production
    }
    throw error;
  }
}

export interface ResetUserPasswordResult {
  userId: string;
  username: string;
  initialPassword: string;
}

/**
 * Admin-mediated password reset: generates a new system password for a
 * target user and sets it directly in Supabase Auth, bypassing the emailed
 * recovery flow. The only recovery path for Physiotherapist/Receptionist,
 * whose email may be a placeholder (AGENTS.md -> Password Policy). Needs no
 * compensating action -- a single external write with no subsequent
 * database step that could fail.
 */
export async function resetUserPassword(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<ResetUserPasswordResult> {
  const isAuthorized = await canManageTargetUser(supabase, callerUserId, targetUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  const initialPassword = generateInitialPassword();
  await setUserPassword(adminClient, targetUser.id, initialPassword);

  return {
    userId: targetUser.id,
    username: targetUser.username,
    initialPassword,
  };
}

/**
 * Updates a user's profile information (full name, phone).
 * Role or other sensitive fields are NOT modifiable here.
 */
export async function updateUserProfile(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string,
  input: { fullName?: string; phone?: string }
): Promise<User> {
  const isAuthorized = await canManageTargetUser(supabase, callerUserId, targetUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient administrative privileges", ErrorCodes.FORBIDDEN);
  }

  // The organization being written to is the target's, not the caller's --
  // canManageTargetUser already forces them equal except for SUPER_ADMIN,
  // which has no organization of its own. The lookup exists for the gate; it
  // also gives this function the NOT_FOUND its siblings already return.
  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }
  if (targetUser.organization_id) {
    await assertOrganizationCanTransact(supabase, targetUser.organization_id);
  }

  const payload: Partial<UpdateUser> = {};
  if (input.fullName !== undefined) payload.full_name = input.fullName;
  if (input.phone !== undefined) payload.phone = input.phone;

  return updateUser(supabase, targetUserId, payload);
}

/**
 * Changes a user's role. Strictly validates hierarchy permissions.
 * Modifies ONLY the role assignment.
 */
export async function changeUserRole(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string,
  targetRole: AppRole
): Promise<User> {
  const roleRecord = await findRoleByName(supabase, targetRole);
  if (!roleRecord) {
    throw new Error(`Role "${targetRole}" does not exist`);
  }

  const isAuthorized = await canUpdateUserRole(supabase, callerUserId, targetUserId, targetRole);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges to assign this role", ErrorCodes.FORBIDDEN);
  }

  // Self-action guard -- see deactivateUser for why this preserves the last-owner invariant.
  if (callerUserId === targetUserId) {
    throw new AppError("You cannot change your own role", ErrorCodes.TARGET_USER_IS_SELF);
  }

  // Target-anchored, and the lookup exists for the gate -- see updateUserProfile.
  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }
  if (targetUser.organization_id) {
    await assertOrganizationCanTransact(supabase, targetUser.organization_id);
  }

  return updateUser(supabase, targetUserId, { role_id: roleRecord.id });
}

/**
 * Activates an organization user.
 * Uses an all-or-nothing consistency model with compensation logic.
 */
export async function activateUser(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<User> {
  const isAuthorized = await canManageTargetUser(supabase, callerUserId, targetUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  // Target-anchored -- see updateUserProfile. Reactivating a user re-expands
  // the organization's footprint, so it gates; deactivate/offboard do not.
  if (targetUser.organization_id) {
    await assertOrganizationCanTransact(supabase, targetUser.organization_id);
  }

  // 1. Enable in Supabase Auth
  await setUserEnabled(adminClient, targetUser.id);

  try {
    // 2. Enable in database
    return await updateUser(supabase, targetUser.id, { is_active: true });
  } catch (error) {
    // Compensation logic: disable in Supabase Auth if database update fails
    try {
      await setUserDisabled(adminClient, targetUser.id);
    } catch {
      // Centralized monitoring alert
    }
    throw error;
  }
}

/**
 * Deactivates an organization user.
 * Uses an all-or-nothing consistency model with compensation logic.
 */
export async function deactivateUser(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<User> {
  const isAuthorized = await canManageTargetUser(supabase, callerUserId, targetUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Blocks self-action. Combined with ROLE_HIERARCHY (authorization.service.ts
  // -- only ORG_OWNER may act on ORG_OWNER), this is what keeps an organization
  // from ever losing its last active owner through this path; there is no
  // separate last-owner count check. Widening owner-management to a non-owner
  // role would silently break that invariant.
  if (callerUserId === targetUserId) {
    throw new AppError("You cannot deactivate your own account", ErrorCodes.TARGET_USER_IS_SELF);
  }

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  // 1. Disable in Supabase Auth
  await setUserDisabled(adminClient, targetUser.id);

  try {
    // 2. Disable in database
    return await updateUser(supabase, targetUser.id, { is_active: false });
  } catch (error) {
    // Compensation logic: enable in Supabase Auth if database update fails
    try {
      await setUserEnabled(adminClient, targetUser.id);
    } catch {
      // Centralized monitoring alert
    }
    throw error;
  }
}

/**
 * Off-boards an organization user (soft delete).
 * Revokes authentication access in Supabase Auth and soft-deletes the user
 * profile (is_active = false, deleted_at = now()) along with associated
 * user-clinic assignments. The Auth identity and application profile are
 * both retained for audit and history.
 * Uses an all-or-nothing consistency model with compensation logic.
 */
export async function offboardUser(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<User> {
  const isAuthorized = await canManageTargetUser(supabase, callerUserId, targetUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Self-action guard -- see deactivateUser for why this preserves the last-owner invariant.
  if (callerUserId === targetUserId) {
    throw new AppError("You cannot offboard your own account", ErrorCodes.TARGET_USER_IS_SELF);
  }

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  if (!targetUser.organization_id) {
    throw new Error("Target user organization reference is missing");
  }

  // 1. Revoke authentication access in Supabase Auth
  await setUserDisabled(adminClient, targetUser.id);

  try {
    // 2. Soft-delete the user profile in database
    const updatedUser = await updateUser(supabase, targetUser.id, {
      is_active: false,
      deleted_at: new Date().toISOString(),
    });

    // 3. Soft-delete user-clinic assignments in database
    await supabase
      .from("user_clinics")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", targetUser.id)
      .eq("organization_id", targetUser.organization_id)
      .is("deleted_at", null);

    return updatedUser;
  } catch (error) {
    // Compensation logic: re-enable Auth in Supabase Auth if database update fails
    try {
      await setUserEnabled(adminClient, targetUser.id);
    } catch {
      // Centralized monitoring alert
    }
    throw error;
  }
}

/**
 * Creates a new clinic. Scopes to the caller's organization.
 */
export async function createClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateClinicInput
): Promise<Clinic> {
  const isAuthorized = await canManageClinics(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const isWithinClinicLimit = await canCreateClinicWithinLimit(supabase, caller.organization_id);
  if (!isWithinClinicLimit) {
    throw new AppError("Organization has reached its subscription plan's clinic limit", ErrorCodes.ORGANIZATION_LIMIT_EXCEEDED);
  }

  // Check clinic name uniqueness within the organization
  const nameCollision = await findClinicByNameInOrg(supabase, caller.organization_id, input.clinicName);
  if (nameCollision) {
    throw new AppError(`Clinic with name "${input.clinicName}" already exists in the organization`, ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS);
  }

  return createClinicInternal(supabase, {
    organization_id: caller.organization_id,
    clinic_name: input.clinicName,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    city: input.city || null,
    state: input.state || null,
    pincode: input.pincode || null,
    gst_number: input.gstNumber || null,
    is_active: true,
  });
}

/**
 * Updates clinic details. Scoped strictly to the organization.
 */
export async function updateClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  clinicId: string,
  input: UpdateClinicInput
): Promise<Clinic> {
  const isAuthorized = await canManageClinics(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (clinic.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  if (input.clinicName && input.clinicName !== clinic.clinic_name) {
    const nameCollision = await findClinicByNameInOrg(supabase, caller.organization_id, input.clinicName);
    if (nameCollision) {
      throw new AppError(`Clinic with name "${input.clinicName}" already exists in the organization`, ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS);
    }
  }

  return updateClinicInternal(supabase, clinicId, {
    clinic_name: input.clinicName,
    email: input.email !== undefined ? input.email || null : undefined,
    phone: input.phone !== undefined ? input.phone || null : undefined,
    address: input.address !== undefined ? input.address || null : undefined,
    city: input.city !== undefined ? input.city || null : undefined,
    state: input.state !== undefined ? input.state || null : undefined,
    pincode: input.pincode !== undefined ? input.pincode || null : undefined,
    gst_number: input.gstNumber !== undefined ? input.gstNumber || null : undefined,
  });
}

/**
 * Toggles a clinic status to active (is_active: true).
 */
export async function activateClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  clinicId: string
): Promise<Clinic> {
  const isAuthorized = await canManageClinics(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (clinic.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return updateClinicInternal(supabase, clinicId, { is_active: true });
}

/**
 * Toggles a clinic status to inactive (is_active: false).
 */
export async function deactivateClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  clinicId: string
): Promise<Clinic> {
  const isAuthorized = await canManageClinics(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (clinic.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return updateClinicInternal(supabase, clinicId, { is_active: false });
}

/**
 * Soft-deletes a clinic (deleted_at = now() & is_active = false)
 * and soft-deletes all associated assignments in user_clinics.
 */
export async function deleteClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  clinicId: string
): Promise<Clinic> {
  const isAuthorized = await canManageClinics(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (clinic.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  // Soft-delete user-clinic assignments
  await supabase
    .from("user_clinics")
    .update({ deleted_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("organization_id", caller.organization_id)
    .is("deleted_at", null);

  return updateClinicInternal(supabase, clinicId, {
    deleted_at: new Date().toISOString(),
    is_active: false,
  });
}

/**
 * Assigns a user to a clinic. Asserts scoping and active user/clinic validation.
 */
export async function assignUserToClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string,
  clinicId: string
): Promise<UserClinic> {
  const isAuthorized = await canAssignUserToClinic(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser || targetUser.deleted_at) {
    throw new AppError("Target user not found or deleted", ErrorCodes.NOT_FOUND);
  }

  if (targetUser.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation on target user", ErrorCodes.FORBIDDEN);
  }

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found or deleted", ErrorCodes.NOT_FOUND);
  }

  if (clinic.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation on clinic", ErrorCodes.FORBIDDEN);
  }

  return upsertAssignmentInternal(supabase, caller.organization_id, targetUserId, clinicId);
}

/**
 * Removes a user assignment from a clinic.
 */
export async function removeUserFromClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string,
  clinicId: string
): Promise<UserClinic> {
  const isAuthorized = await canAssignUserToClinic(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("Target user not found", ErrorCodes.NOT_FOUND);
  }

  if (targetUser.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation on target user", ErrorCodes.FORBIDDEN);
  }

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (clinic.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation on clinic", ErrorCodes.FORBIDDEN);
  }

  return deleteAssignmentInternal(supabase, caller.organization_id, targetUserId, clinicId);
}