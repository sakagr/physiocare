import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic } from "@/server/services/organization.service";
import { renewOrganizationSubscription, expireLapsedSubscriptions } from "@/server/services/subscription.service";
import { validClinicInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Subscription renewal workflow", () => {
  const ctx = setupIntegrationContext("sub-renewal");

  async function setupActiveOrg(suffix: string, subscriptionEndsAt: string) {
    const { data: plan, error: planError } = await ctx.admin
      .from("subscription_plans")
      .insert({ plan_name: `Renewal ${ctx.runId}-${suffix}`, max_clinics: 5, max_users: 5, monthly_price: 100, yearly_price: 1000 })
      .select()
      .single();
    if (planError) throw planError;

    // subscription_starts_at must be on or before subscription_ends_at
    // (organizations_subscription_dates_check) -- always one year earlier.
    const startsAt = new Date(subscriptionEndsAt);
    startsAt.setFullYear(startsAt.getFullYear() - 1);

    const { data: organization, error: orgError } = await ctx.admin
      .from("organizations")
      .insert({
        organization_name: `${ctx.runId}-${suffix}-org`,
        status: "active",
        subscription_plan_id: plan.id,
        subscription_status: "active",
        subscription_starts_at: startsAt.toISOString(),
        subscription_ends_at: subscriptionEndsAt,
      })
      .select()
      .single();
    if (orgError) throw orgError;
    ctx.trackOrganization(organization.id);

    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    const superAdmin = await ctx.createUser(null, "SUPER_ADMIN", `${suffix}-super`);
    return { organization, owner, superAdmin, plan };
  }

  it("renews a subscription by extending from the existing subscription_ends_at, not from now", async () => {
    const currentEndsAt = "2026-03-01T00:00:00.000Z";
    const { organization, superAdmin } = await setupActiveOrg("renew", currentEndsAt);

    const expected = new Date(currentEndsAt);
    expected.setMonth(expected.getMonth() + 1);

    const renewed = await renewOrganizationSubscription(ctx.admin, superAdmin.id, organization.id, "monthly");
    expect(renewed.subscription_status).toBe("active");
    // Compare instants, not raw strings -- Postgres returns timestamptz as
    // "...+00:00", not JS's "...Z" suffix, though both represent the same instant.
    expect(new Date(renewed.subscription_ends_at!).getTime()).toBe(expected.getTime());

    const { data: logs, error } = await ctx.admin
      .from("audit_logs")
      .select("*")
      .eq("entity_id", organization.id)
      .eq("action", "subscription_renewed");
    if (error) throw error;
    expect(logs).toHaveLength(1);
  });

  it("rejects renewal from a terminal status without going through reactivation first", async () => {
    const { organization, superAdmin } = await setupActiveOrg("terminal", "2026-03-01T00:00:00.000Z");
    const { error } = await ctx.admin.from("organizations").update({ subscription_status: "cancelled" }).eq("id", organization.id);
    if (error) throw error;

    await expect(renewOrganizationSubscription(ctx.admin, superAdmin.id, organization.id, "monthly")).rejects.toMatchObject({
      code: ErrorCodes.INVALID_SUBSCRIPTION_TRANSITION,
    });
  });

  it("sweeps an overdue active subscription to past_due, retaining access during the grace period", async () => {
    // 1 day overdue: past subscription_ends_at (triggers active -> past_due)
    // but well within the 7-day grace window, so this single sweep call
    // must not also cascade it straight through to inactive in the same
    // pass (that only happens on a *later* sweep once the grace period
    // itself has elapsed -- see the next test).
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { organization, owner } = await setupActiveOrg("sweep-active", yesterday.toISOString());

    const swept = await expireLapsedSubscriptions(ctx.admin);
    const thisOrg = swept.find((o) => o.id === organization.id);
    expect(thisOrg?.subscription_status).toBe("past_due");

    // past_due still retains access.
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-sweep-active`));
    expect(clinic.organization_id).toBe(organization.id);
  });

  it("sweeps a past_due subscription whose grace period has elapsed all the way to inactive, resetting the plan to NO_SUBSCRIPTION", async () => {
    const { organization, owner } = await setupActiveOrg("sweep-expire", "2000-01-01T00:00:00.000Z");
    const { error } = await ctx.admin.from("organizations").update({ subscription_status: "past_due" }).eq("id", organization.id);
    if (error) throw error;

    const swept = await expireLapsedSubscriptions(ctx.admin);
    const thisOrg = swept.find((o) => o.id === organization.id);
    expect(thisOrg?.subscription_status).toBe("inactive");

    const { data: plan, error: planError } = await ctx.admin
      .from("subscription_plans")
      .select("plan_name")
      .eq("id", thisOrg!.subscription_plan_id)
      .single();
    if (planError) throw planError;
    expect(plan.plan_name).toBe("NO_SUBSCRIPTION");

    // Non-transacting again -- the limits gate reflects NO_SUBSCRIPTION's ceiling immediately.
    await expect(createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-sweep-expire`))).rejects.toMatchObject({
      code: ErrorCodes.SUBSCRIPTION_REQUIRED,
    });

    const { data: logs, error: logsError } = await ctx.admin
      .from("audit_logs")
      .select("action")
      .eq("entity_id", organization.id)
      .in("action", ["subscription_expired", "subscription_reset_to_no_subscription"]);
    if (logsError) throw logsError;
    expect(logs.map((l) => l.action).sort()).toEqual(["subscription_expired", "subscription_reset_to_no_subscription"]);
  });
});
