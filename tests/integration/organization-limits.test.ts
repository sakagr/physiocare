import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic } from "@/server/services/organization.service";
import { createOrganizationUser } from "@/server/services/organization.service";
import { validClinicInput, validOrganizationUserInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Organization limits enforcement", () => {
  const ctx = setupIntegrationContext("org-limits");

  async function setupOrgWithPlan(suffix: string, maxClinics: number, maxUsers: number) {
    const { data: plan, error: planError } = await ctx.admin
      .from("subscription_plans")
      .insert({ plan_name: `Limits ${ctx.runId}-${suffix}`, max_clinics: maxClinics, max_users: maxUsers, monthly_price: 0, yearly_price: 0 })
      .select()
      .single();
    if (planError) throw planError;

    const { data: organization, error: orgError } = await ctx.admin
      .from("organizations")
      .insert({
        organization_name: `${ctx.runId}-${suffix}-org`,
        status: "active",
        subscription_plan_id: plan.id,
        subscription_status: "active",
      })
      .select()
      .single();
    if (orgError) throw orgError;
    ctx.trackOrganization(organization.id);

    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    return { organization, owner, plan };
  }

  it("allows clinic creation up to max_clinics and rejects the next one", async () => {
    const { organization, owner } = await setupOrgWithPlan("clinic", 1, 5);

    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-clinic-1`));
    expect(clinic.organization_id).toBe(organization.id);

    await expect(createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-clinic-2`))).rejects.toMatchObject({
      code: ErrorCodes.ORGANIZATION_LIMIT_EXCEEDED,
    });
  });

  it("allows user creation up to max_users and rejects the next one", async () => {
    // max_users = 2: the ORG_OWNER created by setup already occupies one seat.
    const { owner } = await setupOrgWithPlan("user", 5, 2);

    const created = await createOrganizationUser(ctx.admin, ctx.admin, owner.id, validOrganizationUserInput(`${ctx.runId}-user-1`));
    expect(created.username).toBeTruthy();

    await expect(
      createOrganizationUser(ctx.admin, ctx.admin, owner.id, validOrganizationUserInput(`${ctx.runId}-user-2`))
    ).rejects.toMatchObject({ code: ErrorCodes.ORGANIZATION_LIMIT_EXCEEDED });
  });

  it("does not count a soft-deleted clinic toward the limit", async () => {
    const { owner } = await setupOrgWithPlan("softdel", 1, 5);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-softdel-1`));

    const { error } = await ctx.admin.from("clinics").update({ deleted_at: new Date().toISOString() }).eq("id", clinic.id);
    if (error) throw error;

    const replacement = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-softdel-2`));
    expect(replacement.id).not.toBe(clinic.id);
  });
});
