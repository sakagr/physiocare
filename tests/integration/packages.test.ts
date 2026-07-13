import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import {
  createPackage,
  updatePackage,
  activatePackage,
  deactivatePackage,
  deletePackage,
} from "@/server/services/package.service";
import { createPatient } from "@/server/services/patient.service";
import { findPackageById, listPackages, countPackages } from "@/server/repositories/package.repository";
import { validPackageInput, validPatientInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Package lifecycle", () => {
  const ctx = setupIntegrationContext("packages");

  it("manages package lifecycle, enforces active-name uniqueness, and permits recreation after soft deletion", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-package-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "package-owner");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-one`));

    await expect(createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-one`))).rejects.toMatchObject({ code: ErrorCodes.PACKAGE_NAME_ALREADY_EXISTS });
    expect((await updatePackage(ctx.admin, owner.id, pkg.id, { packagePrice: 6000 })).package_price).toBe(6000);
    expect((await deactivatePackage(ctx.admin, owner.id, pkg.id)).is_active).toBe(false);
    expect((await activatePackage(ctx.admin, owner.id, pkg.id)).is_active).toBe(true);
    expect((await deletePackage(ctx.admin, owner.id, pkg.id)).is_active).toBe(true);
    expect(await findPackageById(ctx.admin, pkg.id)).toBeNull();

    const recreated = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-one`));
    expect(recreated.id).not.toBe(pkg.id);
  });

  it("blocks deletion of a package that has been assigned to a patient", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-assigned-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "assigned-owner");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-assigned`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-assigned`));

    const { error } = await ctx.admin.from("patient_packages").insert({
      organization_id: organization.id,
      patient_id: patient.id,
      package_id: pkg.id,
      package_name: pkg.package_name,
      package_price: pkg.package_price,
      expiry_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      total_sessions: pkg.total_sessions,
      remaining_sessions: pkg.total_sessions,
    });
    expect(error).toBeNull();

    await expect(deletePackage(ctx.admin, owner.id, pkg.id)).rejects.toMatchObject({ code: ErrorCodes.PACKAGE_HAS_ACTIVE_ASSIGNMENTS });
  });

  it("returns only active packages through paginated and searchable repository queries", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-repository-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "repository-owner");
    const matching = await createPackage(ctx.admin, owner.id, { ...validPackageInput(`${ctx.runId}-repository-match`), packageName: `${ctx.runId}-repository-findme` });
    const hidden = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-repository-hidden`));
    await deletePackage(ctx.admin, owner.id, hidden.id);

    const filters = { page: 1, limit: 1, search: "findme" };
    expect(await listPackages(ctx.admin, organization.id, filters)).toEqual([expect.objectContaining({ id: matching.id })]);
    expect(await countPackages(ctx.admin, organization.id, filters)).toBe(1);
  });

  it("enforces organization-wide visibility and tenant isolation at the Postgres level", async () => {
    const orgA = await ctx.createOrganization(`${ctx.runId}-rls-a-org`);
    const ownerA = await ctx.createUser(orgA.id, "ORG_OWNER", "rls-a-owner");
    const receptionistA = await ctx.createUser(orgA.id, "ORG_RECEPTIONIST", "rls-a-recep");
    const packageA = await createPackage(ctx.admin, ownerA.id, validPackageInput(`${ctx.runId}-rls-a`));

    const orgB = await ctx.createOrganization(`${ctx.runId}-rls-b-org`);
    const ownerB = await ctx.createUser(orgB.id, "ORG_OWNER", "rls-b-owner");
    const packageB = await createPackage(ctx.admin, ownerB.id, validPackageInput(`${ctx.runId}-rls-b`));

    // Any active org member (not just the owner/admin who manages the catalog) sees the full org-wide package list.
    const receptionistClient = await ctx.signedInClient(receptionistA.email);
    const { data: receptionistPackages, error: receptionistError } = await receptionistClient.from("packages").select("id");
    expect(receptionistError).toBeNull();
    expect((receptionistPackages ?? []).map((p) => p.id)).toContain(packageA.id);
    expect((receptionistPackages ?? []).map((p) => p.id)).not.toContain(packageB.id);

    // A receptionist cannot write to the catalog (canManagePackages excludes ORG_RECEPTIONIST).
    const { data: receptionistUpdate, error: receptionistUpdateError } = await receptionistClient
      .from("packages")
      .update({ package_price: 1 })
      .eq("id", packageA.id)
      .select();
    expect(receptionistUpdateError).toBeNull();
    expect(receptionistUpdate).toEqual([]);

    // Cross-org isolation and cross-org write are both blocked at the Postgres level.
    const ownerClientA = await ctx.signedInClient(ownerA.email);
    const { data: crossOrgUpdate, error: crossOrgUpdateError } = await ownerClientA
      .from("packages")
      .update({ package_price: 1 })
      .eq("id", packageB.id)
      .select();
    expect(crossOrgUpdateError).toBeNull();
    expect(crossOrgUpdate).toEqual([]);
  });
});
