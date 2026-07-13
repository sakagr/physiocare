import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createPackage } from "@/server/services/package.service";
import { createPatient } from "@/server/services/patient.service";
import {
  createPatientPackage,
  updatePatientPackage,
  deletePatientPackage,
  getPatientPackageDetails,
} from "@/server/services/patient-package.service";
import { validPackageInput, validPatientInput, validPatientPackageInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Patient package assignment lifecycle", () => {
  const ctx = setupIntegrationContext("patient-packages");

  it("assigns a package to a patient with a frozen snapshot, updates it, and soft-deletes it", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-one`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-one`));

    const assignment = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));
    expect(assignment).toMatchObject({
      package_name: pkg.package_name,
      package_price: pkg.package_price,
      total_sessions: pkg.total_sessions,
      remaining_sessions: pkg.total_sessions,
      used_sessions: 0,
      status: "active",
    });

    // Editing the catalog package afterward must not change the frozen snapshot.
    const { updatePackage } = await import("@/server/services/package.service");
    await updatePackage(ctx.admin, owner.id, pkg.id, { packageName: "Renamed Package", packagePrice: 9999 });
    const unchanged = await getPatientPackageDetails(ctx.admin, owner.id, assignment.id);
    expect(unchanged.package_name).toBe(pkg.package_name);
    expect(unchanged.package_price).toBe(pkg.package_price);

    const cancelled = await updatePatientPackage(ctx.admin, owner.id, assignment.id, { status: "cancelled" });
    expect(cancelled.status).toBe("cancelled");

    const deleted = await deletePatientPackage(ctx.admin, owner.id, assignment.id);
    expect(deleted.deleted_at).not.toBeNull();
    await expect(getPatientPackageDetails(ctx.admin, owner.id, assignment.id)).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND });
  });

  it("blocks deletion once sessions are consumed or an invoice references the assignment", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-blocked-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "blocked-owner");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-blocked`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-blocked`));
    const assignment = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));

    const { error: usedError } = await ctx.admin
      .from("patient_packages")
      .update({ used_sessions: 1, remaining_sessions: assignment.total_sessions - 1 })
      .eq("id", assignment.id);
    expect(usedError).toBeNull();

    await expect(deletePatientPackage(ctx.admin, owner.id, assignment.id)).rejects.toMatchObject({ code: ErrorCodes.PATIENT_PACKAGE_HAS_REFERENCES });
  });
});
