import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Organization } from "../repositories/organization.repository";
import {
  findOrganizationById,
  updateOrganizationSubscription,
  listOrganizationsByLapseCriteria,
} from "../repositories/organization.repository";
import { findSubscriptionPlanByName, findSubscriptionPlanById } from "../repositories/subscription.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { canManageSubscription, canActivateSubscription } from "./authorization.service";
import { recordAuditLog } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

/**
 * Number of days a self-service trial runs before it must be converted to a
 * paid plan or lapses. Not derived from any input in this phase -- a fixed
 * operational constant.
 */
const TRIAL_LENGTH_DAYS = 14;

/**
 * Grace period after subscription_ends_at during which a past_due
 * subscription still retains access before being swept to expired.
 */
const PAST_DUE_GRACE_DAYS = 7;

/**
 * Legal subscription_status transitions. inactive -> trialing is
 * self-service (starting a trial); inactive -> active is platform-only
 * (activating a previously-selected paid plan). trialing/past_due -> active
 * are conversion/renewal-recovery paths. cancelled/expired can only be
 * reactivated by returning to inactive first (a fresh plan selection), not
 * directly back to active.
 */
const LEGAL_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  inactive: ["trialing", "active"],
  trialing: ["active", "expired", "cancelled"],
  active: ["past_due", "cancelled"],
  past_due: ["active", "expired", "cancelled"],
  cancelled: ["inactive"],
  expired: ["inactive"],
};

/**
 * Pure transition-legality check, exported so subscription-renewal
 * workflows (renewal, lapse sweeps) can reuse this matrix without
 * duplicating it.
 */
export function isLegalSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return LEGAL_SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

/**
 * audit_logs.user_id has a composite FK requiring (organization_id, user_id)
 * to resolve to a real user row in that organization -- fine for
 * self-service actions, but a platform billing role activating/renewing a
 * subscription doesn't belong to the organization being acted on at all.
 * Passing null satisfies the FK (a null column is exempt from a composite
 * FK check) and is the correct representation of "a platform actor, not an
 * organization member, performed this."
 */
async function resolveAuditActorUserId(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  organizationId: string
): Promise<string | null> {
  const caller = await findUserById(supabase, callerUserId);
  return caller?.organization_id === organizationId ? callerUserId : null;
}

/**
 * Selects a subscription plan for an organization. Only legal starting from
 * subscription_status = "inactive" (a brand-new organization on
 * NO_SUBSCRIPTION, or one that has lapsed back to inactive).
 *
 * Selecting "Trial" is fully self-service: it immediately transitions
 * subscription_status to "trialing" with a fixed-length window.
 *
 * Selecting any other (paid) plan sets subscription_plan_id only --
 * subscription_status is deliberately left at "inactive" (still
 * non-transacting) until a platform billing role calls
 * activateOrganizationSubscription(). No payment automation exists in this
 * codebase, so a paid plan is never auto-activated by self-service
 * selection alone.
 */
export async function selectSubscriptionPlan(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  organizationId: string,
  planName: string
): Promise<Organization> {
  const isAuthorized = await canManageSubscription(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const callerRole = await findRoleById(supabase, caller.role_id);
  if (callerRole?.name === "ORG_OWNER" && caller.organization_id !== organizationId) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    throw new AppError("Organization not found", ErrorCodes.NOT_FOUND);
  }

  if (planName === "NO_SUBSCRIPTION") {
    throw new AppError("Cannot select the NO_SUBSCRIPTION plan directly", ErrorCodes.INVALID_SUBSCRIPTION_TRANSITION);
  }

  if (organization.subscription_status !== "inactive") {
    throw new AppError(
      `Cannot select a new plan while subscription status is ${organization.subscription_status}`,
      ErrorCodes.INVALID_SUBSCRIPTION_TRANSITION
    );
  }

  const plan = await findSubscriptionPlanByName(supabase, planName);
  if (!plan) {
    throw new AppError("Subscription plan not found", ErrorCodes.SUBSCRIPTION_PLAN_NOT_FOUND);
  }

  if (plan.plan_name === "Trial") {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + TRIAL_LENGTH_DAYS);

    const updated = await updateOrganizationSubscription(supabase, organizationId, {
      subscription_plan_id: plan.id,
      subscription_status: "trialing",
      subscription_starts_at: startsAt.toISOString(),
      subscription_ends_at: endsAt.toISOString(),
    });

    await recordAuditLog(supabase, {
      organizationId,
      userId: caller.organization_id === organizationId ? callerUserId : null,
      action: "subscription_trial_started",
      entityName: "organizations",
      entityId: organizationId,
      oldData: { subscription_plan_id: organization.subscription_plan_id, subscription_status: organization.subscription_status },
      newData: { subscription_plan_id: updated.subscription_plan_id, subscription_status: updated.subscription_status },
    });

    return updated;
  }

  const updated = await updateOrganizationSubscription(supabase, organizationId, {
    subscription_plan_id: plan.id,
  });

  await recordAuditLog(supabase, {
    organizationId,
    userId: caller.organization_id === organizationId ? callerUserId : null,
    action: "subscription_plan_selected",
    entityName: "organizations",
    entityId: organizationId,
    oldData: { subscription_plan_id: organization.subscription_plan_id },
    newData: { subscription_plan_id: updated.subscription_plan_id },
  });

  return updated;
}

/**
 * Activates a previously-selected paid plan (or converts an active trial to
 * paid), setting subscription_status = "active" with a billing cycle
 * window. Platform billing roles only.
 */
export async function activateOrganizationSubscription(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  organizationId: string,
  cycle: "monthly" | "yearly"
): Promise<Organization> {
  const isAuthorized = await canActivateSubscription(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    throw new AppError("Organization not found", ErrorCodes.NOT_FOUND);
  }

  const plan = await findSubscriptionPlanById(supabase, organization.subscription_plan_id);
  if (!plan || plan.plan_name === "NO_SUBSCRIPTION") {
    throw new AppError("No subscription plan has been selected for this organization", ErrorCodes.SUBSCRIPTION_PLAN_NOT_FOUND);
  }

  if (!isLegalSubscriptionTransition(organization.subscription_status, "active")) {
    throw new AppError(
      `Cannot activate a subscription from status ${organization.subscription_status}`,
      ErrorCodes.INVALID_SUBSCRIPTION_TRANSITION
    );
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  if (cycle === "monthly") {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }

  const updated = await updateOrganizationSubscription(supabase, organizationId, {
    subscription_status: "active",
    subscription_starts_at: startsAt.toISOString(),
    subscription_ends_at: endsAt.toISOString(),
  });

  await recordAuditLog(supabase, {
    organizationId,
    userId: await resolveAuditActorUserId(supabase, callerUserId, organizationId),
    action: "subscription_activated",
    entityName: "organizations",
    entityId: organizationId,
    oldData: { subscription_status: organization.subscription_status },
    newData: {
      subscription_status: updated.subscription_status,
      subscription_starts_at: updated.subscription_starts_at,
      subscription_ends_at: updated.subscription_ends_at,
    },
  });

  return updated;
}

/**
 * Renews an organization's subscription for another billing cycle. Extends
 * subscription_ends_at from its *current* value (not from now), so an early
 * renewal never loses already-paid time. If the organization had lapsed
 * into past_due, this also recovers it back to active. Platform billing
 * roles only, same as activation.
 */
export async function renewOrganizationSubscription(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  organizationId: string,
  cycle: "monthly" | "yearly"
): Promise<Organization> {
  const isAuthorized = await canActivateSubscription(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const organization = await findOrganizationById(supabase, organizationId);
  if (!organization) {
    throw new AppError("Organization not found", ErrorCodes.NOT_FOUND);
  }

  // Unlike activation, renewal is not a state-machine transition when the
  // subscription is already active -- it's the common case (renewing
  // before expiry), not a change of status at all. Legal starting points
  // are "still active" and "in the past_due grace period" (a recovery
  // renewal); anything else must go through selectSubscriptionPlan/
  // activateOrganizationSubscription first.
  if (organization.subscription_status !== "active" && organization.subscription_status !== "past_due") {
    throw new AppError(
      `Cannot renew a subscription from status ${organization.subscription_status}`,
      ErrorCodes.INVALID_SUBSCRIPTION_TRANSITION
    );
  }

  const baseDate = organization.subscription_ends_at ? new Date(organization.subscription_ends_at) : new Date();
  const endsAt = new Date(baseDate);
  if (cycle === "monthly") {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }

  const updated = await updateOrganizationSubscription(supabase, organizationId, {
    subscription_status: "active",
    subscription_ends_at: endsAt.toISOString(),
  });

  await recordAuditLog(supabase, {
    organizationId,
    userId: await resolveAuditActorUserId(supabase, callerUserId, organizationId),
    action: "subscription_renewed",
    entityName: "organizations",
    entityId: organizationId,
    oldData: { subscription_status: organization.subscription_status, subscription_ends_at: organization.subscription_ends_at },
    newData: { subscription_status: updated.subscription_status, subscription_ends_at: updated.subscription_ends_at },
  });

  return updated;
}

/**
 * Batch sweep: transitions active subscriptions whose subscription_ends_at
 * has passed to past_due (retaining access for a grace period), then
 * transitions past_due subscriptions whose grace period has also elapsed
 * all the way to inactive with subscription_plan_id reset to
 * NO_SUBSCRIPTION (an organization is never left pointing at a real paid
 * plan in a terminal, unbilled state, and inactive is the only status from
 * which a fresh plan can be selected again). Each step is recorded as its
 * own audit_logs entry.
 *
 * No scheduler wiring exists in this codebase (confirmed -- no cron/queue
 * setup anywhere in src/ or supabase/). This is a plain callable function;
 * triggering it on a schedule is Phase 9 (Operations & Deployment)
 * territory. userId is always null in these audit entries -- there is no
 * caller, this is a system sweep.
 */
export async function expireLapsedSubscriptions(supabase: SupabaseClient<Database>): Promise<Organization[]> {
  const nowIso = new Date().toISOString();
  const results: Organization[] = [];

  const newlyOverdue = await listOrganizationsByLapseCriteria(supabase, "active", nowIso);
  for (const organization of newlyOverdue) {
    const updated = await updateOrganizationSubscription(supabase, organization.id, { subscription_status: "past_due" });
    await recordAuditLog(supabase, {
      organizationId: organization.id,
      userId: null,
      action: "subscription_past_due",
      entityName: "organizations",
      entityId: organization.id,
      oldData: { subscription_status: "active" },
      newData: { subscription_status: "past_due" },
    });
    results.push(updated);
  }

  const graceDeadline = new Date();
  graceDeadline.setDate(graceDeadline.getDate() - PAST_DUE_GRACE_DAYS);
  const graceExpired = await listOrganizationsByLapseCriteria(supabase, "past_due", graceDeadline.toISOString());

  if (graceExpired.length > 0) {
    const noSubscriptionPlan = await findSubscriptionPlanByName(supabase, "NO_SUBSCRIPTION");
    if (!noSubscriptionPlan) {
      throw new Error("NO_SUBSCRIPTION system plan is missing; check that migrations have run");
    }

    for (const organization of graceExpired) {
      await updateOrganizationSubscription(supabase, organization.id, { subscription_status: "expired" });
      await recordAuditLog(supabase, {
        organizationId: organization.id,
        userId: null,
        action: "subscription_expired",
        entityName: "organizations",
        entityId: organization.id,
        oldData: { subscription_status: "past_due" },
        newData: { subscription_status: "expired" },
      });

      const updated = await updateOrganizationSubscription(supabase, organization.id, {
        subscription_status: "inactive",
        subscription_plan_id: noSubscriptionPlan.id,
      });
      await recordAuditLog(supabase, {
        organizationId: organization.id,
        userId: null,
        action: "subscription_reset_to_no_subscription",
        entityName: "organizations",
        entityId: organization.id,
        oldData: { subscription_status: "expired", subscription_plan_id: organization.subscription_plan_id },
        newData: { subscription_status: "inactive", subscription_plan_id: updated.subscription_plan_id },
      });
      results.push(updated);
    }
  }

  return results;
}
