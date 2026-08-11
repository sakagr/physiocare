import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import {
  createPatient,
  updatePatient,
  deletePatient,
  getPatientDetails,
  listOrganizationPatients,
} from "@/server/services/patient.service";
import { createPatientRecord, deletePatientRecord } from "@/server/services/patient-record.service";
import { countPatients, findPatientById, listPatients } from "@/server/repositories/patient.repository";
import { validClinicInput, validPatientInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Patient lifecycle", () => {
  const ctx = setupIntegrationContext("patients");

  it("creates a patient with a generated sequential patient code, updates, and soft-deletes it", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-patient-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "patient-owner");

    const first = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-one`));
    expect(first.patient_code).toBe("PT-000001");

    const second = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-two`));
    expect(second.patient_code).toBe("PT-000002");

    const updated = await updatePatient(ctx.admin, owner.id, first.id, { phone: "9998887770" });
    expect(updated.phone).toBe("9998887770");

    const deleted = await deletePatient(ctx.admin, owner.id, first.id);
    expect(deleted.deleted_at).not.toBeNull();
    expect(await findPatientById(ctx.admin, first.id)).toBeNull();
  });

  it("scopes patient code sequences per organization", async () => {
    const orgA = await ctx.createOrganization(`${ctx.runId}-code-org-a`);
    const orgB = await ctx.createOrganization(`${ctx.runId}-code-org-b`);
    const ownerA = await ctx.createUser(orgA.id, "ORG_OWNER", "code-owner-a");
    const ownerB = await ctx.createUser(orgB.id, "ORG_OWNER", "code-owner-b");

    const patientA = await createPatient(ctx.admin, ownerA.id, validPatientInput(`${ctx.runId}-code-a`));
    const patientB = await createPatient(ctx.admin, ownerB.id, validPatientInput(`${ctx.runId}-code-b`));

    expect(patientA.patient_code).toBe("PT-000001");
    expect(patientB.patient_code).toBe("PT-000001");
  });

  it("blocks deletion of a patient with existing clinical references", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-block-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "block-owner");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "block-physio");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-block`));
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-block`));

    const { error } = await ctx.admin.from("appointments").insert({
      organization_id: organization.id,
      patient_id: patient.id,
      clinic_id: clinic.id,
      physiotherapist_id: physio.id,
      appointment_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    expect(error).toBeNull();

    await expect(deletePatient(ctx.admin, owner.id, patient.id)).rejects.toMatchObject({
      code: ErrorCodes.PATIENT_HAS_DEPENDENT_RECORDS,
    });
  });

  it("returns only active patients through paginated and searchable repository queries", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-search-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "search-owner");
    const matching = await createPatient(ctx.admin, owner.id, {
      ...validPatientInput(`${ctx.runId}-search-match`),
      emergencyContact: "Jane Doe 8887776665",
    });
    const hidden = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-search-hidden`));
    await ctx.admin.from("patients").update({ deleted_at: new Date().toISOString() }).eq("id", hidden.id);

    const filters = { page: 1, limit: 10, search: "jane doe" };
    expect(await listPatients(ctx.admin, organization.id, filters)).toEqual([expect.objectContaining({ id: matching.id })]);
    expect(await countPatients(ctx.admin, organization.id, filters)).toBe(1);
  });

  it("lets a patient be deleted once its only record has been soft-deleted", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-record-ref-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "record-ref-owner");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-record-ref`));

    const record = await createPatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, {
      recordType: "xray",
      title: "Only record",
      fileBuffer: Buffer.from("%PDF-1.4 only"),
      fileName: "only.pdf",
      mimeType: "application/pdf",
    });

    await expect(deletePatient(ctx.admin, owner.id, patient.id)).rejects.toMatchObject({
      code: ErrorCodes.PATIENT_HAS_DEPENDENT_RECORDS,
    });

    // existsPatientRecordForPatient feeds hasClinicalReferences, so the
    // deleted_at filter it gains also loosens patient deletion -- otherwise
    // the block would cite records that no longer exist.
    await deletePatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, record.id);
    expect((await deletePatient(ctx.admin, owner.id, patient.id)).deleted_at).not.toBeNull();
  });

  it("writes audit entries for patient create, update, and delete", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-patient-audit-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "patient-audit-owner");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-patient-audit`));
    await updatePatient(ctx.admin, owner.id, patient.id, { fullName: "Renamed Patient" });
    await deletePatient(ctx.admin, owner.id, patient.id);

    const { data: entries } = await ctx.admin
      .from("audit_logs")
      .select("action, entity_name, old_data, new_data")
      .eq("entity_id", patient.id)
      .order("created_at", { ascending: true });

    expect((entries ?? []).map((entry) => entry.action)).toEqual(["create", "update", "delete"]);
    expect(entries?.every((entry) => entry.entity_name === "patients")).toBe(true);
    expect(entries?.[0].new_data).toMatchObject({ patient_code: patient.patient_code });
    expect(entries?.[1].old_data).toMatchObject({ full_name: patient.full_name });
    expect(entries?.[1].new_data).toMatchObject({ full_name: "Renamed Patient" });
    expect(entries?.[2].old_data).toMatchObject({ full_name: "Renamed Patient" });
  });

  it("enforces organization scoping and read access through the service layer", async () => {
    const orgA = await ctx.createOrganization(`${ctx.runId}-scope-org-a`);
    const orgB = await ctx.createOrganization(`${ctx.runId}-scope-org-b`);
    const ownerA = await ctx.createUser(orgA.id, "ORG_OWNER", "scope-owner-a");
    const ownerB = await ctx.createUser(orgB.id, "ORG_OWNER", "scope-owner-b");
    const patientA = await createPatient(ctx.admin, ownerA.id, validPatientInput(`${ctx.runId}-scope-a`));

    expect((await getPatientDetails(ctx.admin, ownerA.id, patientA.id)).id).toBe(patientA.id);
    await expect(getPatientDetails(ctx.admin, ownerB.id, patientA.id)).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    const result = await listOrganizationPatients(ctx.admin, ownerA.id, { page: 1, limit: 10 });
    expect(result.items.map((p) => p.id)).toContain(patientA.id);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});
