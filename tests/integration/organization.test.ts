import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { bootstrapOrganization, getOrganizationDetail, updateOrganizationProfile } from "@/server/services/organization.service";
import { listSelectableSubscriptionPlans } from "@/server/services/subscription.service";
import { validOrganizationInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Organization bootstrap", () => {
  const ctx = setupIntegrationContext("organization");

  it("bootstraps an active organization with its owner and creator assignment", async () => {
    const input = validOrganizationInput(ctx.runId.slice(-6));
    input.organizationName = `${input.organizationName} ${ctx.runId}`;
    input.adminEmail = `${ctx.runId}-bootstrap@example.test`;
    input.adminUsername = `${ctx.runId}-owner`.slice(0, 50);

    const result = await bootstrapOrganization(ctx.admin, ctx.admin, input);
    ctx.trackOrganization(result.organizationId);
    ctx.trackUser(result.adminUserId);

    const { data: organization, error: organizationError } = await ctx.admin.from("organizations").select("*").eq("id", result.organizationId).single();
    if (organizationError) throw organizationError;
    const { data: owner, error: ownerError } = await ctx.admin.from("users").select("*, roles!inner(name)").eq("id", result.adminUserId).single();
    if (ownerError) throw ownerError;

    expect(organization).toMatchObject({ status: "active", created_by: result.adminUserId, subscription_status: "inactive" });
    expect(owner.username).toBe(result.adminUsername);
    expect((owner.roles as { name: string }).name).toBe("ORG_OWNER");

    const { data: plan, error: planError } = await ctx.admin
      .from("subscription_plans")
      .select("plan_name")
      .eq("id", organization.subscription_plan_id)
      .single();
    if (planError) throw planError;
    expect(plan.plan_name).toBe("NO_SUBSCRIPTION");
  });

  it("points the owner's invitation at the set-password screen", async () => {
    const input = validOrganizationInput(`${ctx.runId.slice(-6)}-inv`);
    input.organizationName = `${input.organizationName} ${ctx.runId} invite`;
    input.adminEmail = `${ctx.runId}-invite@example.test`;
    input.adminUsername = `${ctx.runId}-invite-owner`.slice(0, 50);

    // The admin client is wrapped so the invitation's redirect target can be
    // observed: without one, an invited owner would land in the app with no
    // password ever collected.
    let redirectTo: string | undefined;
    const recordingAdmin = {
      ...ctx.admin,
      auth: {
        ...ctx.admin.auth,
        admin: {
          ...ctx.admin.auth.admin,
          inviteUserByEmail: async (email: string, options?: { redirectTo?: string }) => {
            redirectTo = options?.redirectTo;
            return ctx.admin.auth.admin.inviteUserByEmail(email, options);
          },
        },
      },
    } as typeof ctx.admin;

    const result = await bootstrapOrganization(ctx.admin, recordingAdmin, input);
    ctx.trackOrganization(result.organizationId);
    ctx.trackUser(result.adminUserId);

    expect(redirectTo).toBe(
      `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=%2Finvite`
    );
  });

  it("rejects duplicate organization names before creating another Auth identity", async () => {
    const existing = await ctx.createOrganization(`${ctx.runId}-duplicate-organization`);
    const input = validOrganizationInput("duplicate");
    input.organizationName = existing.organization_name;
    input.adminEmail = `${ctx.runId}-unique-duplicate@example.test`;
    input.adminUsername = `${ctx.runId}-duplicate-owner`.slice(0, 50);

    await expect(bootstrapOrganization(ctx.admin, ctx.admin, input)).rejects.toMatchObject({ code: ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS });
  });
});

describeIntegration("Organization profile (M1)", () => {
  const ctx = setupIntegrationContext("org-profile");

  it("lets ORG_OWNER update their own organization's profile through a real RLS-scoped session", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-profile-owner-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "profile-owner");
    const session = await ctx.signedInClient(owner.email);

    const updated = await updateOrganizationProfile(session, owner.id, organization.id, {
      organizationName: `${organization.organization_name} Renamed`,
    });

    expect(updated.organization_name).toBe(`${organization.organization_name} Renamed`);
  });

  it("blocks ORG_ADMIN with FORBIDDEN from the predicate, not a DB-level failure", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-profile-admin-org`);
    const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "profile-admin");
    const session = await ctx.signedInClient(admin.email);

    await expect(
      updateOrganizationProfile(session, admin.id, organization.id, { organizationName: "Should Not Apply" })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  /**
   * `organizations_select_policy` (`id = current_organization_id()`) already
   * scopes reads to the caller's own organization, so a real session-scoped
   * read of a different organization returns nothing before the service's
   * own explicit scoping check is ever reached -- the observable failure is
   * NOT_FOUND (RLS hides the other organization's existence), not FORBIDDEN.
   * The explicit `caller.organization_id !== organizationId` check in
   * `updateOrganizationProfile` is what actually fires for an admin-client
   * caller, where RLS doesn't apply.
   */
  it("rejects an ORG_OWNER updating a different organization's profile (cross-org scoping)", async () => {
    const own = await ctx.createOrganization(`${ctx.runId}-profile-scope-own`);
    const other = await ctx.createOrganization(`${ctx.runId}-profile-scope-other`);
    const owner = await ctx.createUser(own.id, "ORG_OWNER", "profile-scope-owner");
    const session = await ctx.signedInClient(owner.email);

    await expect(
      updateOrganizationProfile(session, owner.id, other.id, { organizationName: "Should Not Apply" })
    ).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND });
  });
});

describeIntegration("Organization detail + subscription plan catalog (M2)", () => {
  const ctx = setupIntegrationContext("org-detail");

  it("gives ORG_OWNER the full profile with subscription and usage populated", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-detail-owner-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "detail-owner");
    const session = await ctx.signedInClient(owner.email);

    const detail = await getOrganizationDetail(session, owner.id, organization.id);

    expect(detail).toMatchObject({
      id: organization.id,
      organizationName: organization.organization_name,
      status: "active",
    });
    expect(detail.subscription).toMatchObject({
      planName: "Integration Test Fixture Plan",
      status: "active",
      usage: { clinics: { used: 0, max: 1000 }, users: { used: 1, max: 1000 } },
    });
  });

  it("gives ORG_ADMIN the profile with subscription null", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-detail-admin-org`);
    const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "detail-admin");
    const session = await ctx.signedInClient(admin.email);

    const detail = await getOrganizationDetail(session, admin.id, organization.id);

    expect(detail.id).toBe(organization.id);
    expect(detail.subscription).toBeNull();
  });

  it("rejects an ORG_OWNER reading a different organization's detail (cross-org scoping)", async () => {
    const own = await ctx.createOrganization(`${ctx.runId}-detail-scope-own`);
    const other = await ctx.createOrganization(`${ctx.runId}-detail-scope-other`);
    const owner = await ctx.createUser(own.id, "ORG_OWNER", "detail-scope-owner");
    const session = await ctx.signedInClient(owner.email);

    await expect(getOrganizationDetail(session, owner.id, other.id)).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND });
  });

  it("lists the plan catalog for ORG_OWNER, excluding NO_SUBSCRIPTION, and forbids ORG_ADMIN", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-catalog-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "catalog-owner");
    const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "catalog-admin");
    const ownerSession = await ctx.signedInClient(owner.email);
    const adminSession = await ctx.signedInClient(admin.email);

    const plans = await listSelectableSubscriptionPlans(ownerSession, owner.id);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((plan) => plan.plan_name === "Trial")).toBe(true);
    expect(plans.some((plan) => plan.plan_name === "NO_SUBSCRIPTION")).toBe(false);

    await expect(listSelectableSubscriptionPlans(adminSession, admin.id)).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});
