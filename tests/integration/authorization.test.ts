import { expect, it } from "vitest";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { getAccessibleClinicIds } from "@/server/services/authorization.service";
import { validClinicInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Authorization and tenant isolation", () => {
  const ctx = setupIntegrationContext("authorization");

  it("returns all active organization clinics to managers and only assigned clinics to employees", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-access-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "access-owner");
    const employee = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "access-employee");
    const firstClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-access-one`));
    const secondClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-access-two`));

    expect(await getAccessibleClinicIds(ctx.admin, owner.id)).toEqual(expect.arrayContaining([firstClinic.id, secondClinic.id]));
    expect(await getAccessibleClinicIds(ctx.admin, employee.id)).toEqual([]);
    await assignUserToClinic(ctx.admin, owner.id, employee.id, firstClinic.id);
    expect(await getAccessibleClinicIds(ctx.admin, employee.id)).toEqual([firstClinic.id]);
  });

  it("enforces RLS tenant isolation for normal authenticated clients", async () => {
    const firstOrganization = await ctx.createOrganization(`${ctx.runId}-rls-first`);
    const secondOrganization = await ctx.createOrganization(`${ctx.runId}-rls-second`);
    const firstOwner = await ctx.createUser(firstOrganization.id, "ORG_OWNER", "rls-first-owner");
    const secondOwner = await ctx.createUser(secondOrganization.id, "ORG_OWNER", "rls-second-owner");
    const firstClinic = await createClinic(ctx.admin, firstOwner.id, validClinicInput(`${ctx.runId}-rls-first`));
    const secondClinic = await createClinic(ctx.admin, secondOwner.id, validClinicInput(`${ctx.runId}-rls-second`));
    const firstClient = await ctx.signedInClient(firstOwner.email);

    const { data: visibleClinics, error: visibleClinicsError } = await firstClient.from("clinics").select("id");
    expect(visibleClinicsError).toBeNull();
    const visibleClinicIds = (visibleClinics ?? []).map((clinic) => clinic.id);
    expect(visibleClinicIds).toContain(firstClinic.id);
    expect(visibleClinicIds).not.toContain(secondClinic.id);

    const { data: crossTenantUpdate, error: crossTenantUpdateError } = await firstClient
      .from("clinics")
      .update({ city: "Forbidden" })
      .eq("id", secondClinic.id)
      .select();
    expect(crossTenantUpdateError).toBeNull();
    expect(crossTenantUpdate).toEqual([]);
  });
});
