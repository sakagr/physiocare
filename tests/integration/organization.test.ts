import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { bootstrapOrganization } from "@/server/services/organization.service";
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
