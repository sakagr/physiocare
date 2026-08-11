import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createPackage } from "@/server/services/package.service";
import { createPatient } from "@/server/services/patient.service";
import {
  createPatientPackage,
  updatePatientPackage,
  deletePatientPackage,
  getPatientPackageDetails,
  listPatientPackagesForPatient,
  listOrganizationPatientPackages,
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

    const { data: raw, error: rawError } = await ctx.admin
      .from("patient_packages")
      .select("cancelled_at, cancelled_by")
      .eq("id", assignment.id)
      .single();
    if (rawError) throw rawError;
    expect(raw.cancelled_at).not.toBeNull();
    expect(raw.cancelled_by).toBe(owner.id);

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

  it("keeps patient_packages_view's exposed columns in sync with the table", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-view-columns-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "view-columns-owner");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-view-columns`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-view-columns`));
    const assignment = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));

    const { data: tableRow, error: tableError } = await ctx.admin
      .from("patient_packages")
      .select("*")
      .eq("id", assignment.id)
      .single();
    if (tableError) throw tableError;

    const { data: viewRow, error: viewError } = await ctx.admin
      .from("patient_packages_view")
      .select("*")
      .eq("id", assignment.id)
      .single();
    if (viewError) throw viewError;

    expect(Object.keys(viewRow).sort()).toEqual([...Object.keys(tableRow), "status"].sort());
  });

  it("keeps patient_packages_view RLS-scoped to the querying organization", async () => {
    const orgA = await ctx.createOrganization(`${ctx.runId}-view-rls-a-org`);
    const ownerA = await ctx.createUser(orgA.id, "ORG_OWNER", "view-rls-a-owner");
    const pkgA = await createPackage(ctx.admin, ownerA.id, validPackageInput(`${ctx.runId}-view-rls-a`));
    const patientA = await createPatient(ctx.admin, ownerA.id, validPatientInput(`${ctx.runId}-view-rls-a`));
    const assignmentA = await createPatientPackage(ctx.admin, ownerA.id, validPatientPackageInput({ patientId: patientA.id, packageId: pkgA.id }));

    const orgB = await ctx.createOrganization(`${ctx.runId}-view-rls-b-org`);
    const ownerB = await ctx.createUser(orgB.id, "ORG_OWNER", "view-rls-b-owner");

    const clientB = await ctx.signedInClient(ownerB.email);
    const { data, error } = await clientB.from("patient_packages_view").select("id").eq("id", assignmentA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("derives expired status live in both list paths, with no separate evaluate step", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-list-expired-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "list-expired-owner");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-list-expired`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-list-expired`));
    const assignment = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));

    const { error } = await ctx.admin
      .from("patient_packages")
      .update({ purchased_on: "2000-01-01", expiry_date: "2000-01-31" })
      .eq("id", assignment.id);
    if (error) throw error;

    const patientList = await listPatientPackagesForPatient(ctx.admin, owner.id, patient.id, { page: 1, limit: 10 });
    expect(patientList.items).toHaveLength(1);
    expect(patientList.items[0].status).toBe("expired");

    const orgList = await listOrganizationPatientPackages(ctx.admin, owner.id, { page: 1, limit: 10, patientId: patient.id });
    expect(orgList.items).toHaveLength(1);
    expect(orgList.items[0].status).toBe("expired");
  });

  it("writes audit entries naming the assignment lifecycle transition that happened", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-assignment-audit-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "assignment-audit-owner");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-assignment-audit`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-assignment-audit`));

    const assignment = await createPatientPackage(
      ctx.admin,
      owner.id,
      validPatientPackageInput({ patientId: patient.id, packageId: pkg.id })
    );
    await updatePatientPackage(ctx.admin, owner.id, assignment.id, { extendedValidityTo: "2030-01-01" });
    await updatePatientPackage(ctx.admin, owner.id, assignment.id, { status: "cancelled" });
    await deletePatientPackage(ctx.admin, owner.id, assignment.id);

    const { data: entries } = await ctx.admin
      .from("audit_logs")
      .select("action, entity_name, old_data, new_data")
      .eq("entity_id", assignment.id)
      .order("created_at", { ascending: true });

    // updatePatientPackage is one function serving two intents; each emits its
    // own verb rather than a shared "update".
    expect((entries ?? []).map((entry) => entry.action)).toEqual([
      "create",
      "extend_validity",
      "cancel",
      "delete",
    ]);
    expect(entries?.every((entry) => entry.entity_name === "patient_packages")).toBe(true);
    expect(entries?.[1].new_data).toMatchObject({ extended_validity_to: "2030-01-01" });
    expect(entries?.[2].new_data).toMatchObject({ status: "cancelled" });
  });
});
