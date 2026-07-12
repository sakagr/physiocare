import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, deleteClinic, updateClinic, activateClinic, deactivateClinic } from "@/server/services/organization.service";
import { countClinics, findClinicById, listClinics } from "@/server/repositories/clinic.repository";
import { validClinicInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Clinic lifecycle", () => {
  const ctx = setupIntegrationContext("clinics");

  it("manages clinic lifecycle, enforces active-name uniqueness, and permits recreation after soft deletion", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-clinic-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "clinic-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`));

    await expect(createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`))).rejects.toMatchObject({ code: ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS });
    expect((await updateClinic(ctx.admin, owner.id, clinic.id, { city: "Mumbai" })).city).toBe("Mumbai");
    expect((await deactivateClinic(ctx.admin, owner.id, clinic.id)).is_active).toBe(false);
    expect((await activateClinic(ctx.admin, owner.id, clinic.id)).is_active).toBe(true);
    expect((await deleteClinic(ctx.admin, owner.id, clinic.id)).is_active).toBe(false);
    expect(await findClinicById(ctx.admin, clinic.id)).toBeNull();

    const recreated = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`));
    expect(recreated.id).not.toBe(clinic.id);
  });

  it("returns only active clinics through paginated and searchable repository queries", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-repository-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "repository-owner");
    const matching = await createClinic(ctx.admin, owner.id, { ...validClinicInput(`${ctx.runId}-repository-match`), city: "Pune" });
    const hidden = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-repository-hidden`));
    await deleteClinic(ctx.admin, owner.id, hidden.id);

    const filters = { page: 1, limit: 1, search: "pune" };
    expect(await listClinics(ctx.admin, organization.id, filters)).toEqual([expect.objectContaining({ id: matching.id })]);
    expect(await countClinics(ctx.admin, organization.id, filters)).toBe(1);
  });
});
