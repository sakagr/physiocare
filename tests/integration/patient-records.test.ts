import { expect, it, vi } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import {
  createPatientRecord,
  listPatientRecords,
  getPatientRecordDetails,
} from "@/server/services/patient-record.service";
import * as patientRecordRepository from "@/server/repositories/patient-record.repository";
import { validAppointmentInput, validClinicInput, validPatientInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Patient record uploads", () => {
  const ctx = setupIntegrationContext("patient-records");

  it("uploads a record, lists it with a signed download URL, and fetches its detail", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-lifecycle-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "lifecycle-owner");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-record-lifecycle`));

    const record = await createPatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, {
      recordType: "xray",
      title: "Knee X-Ray",
      fileBuffer: Buffer.from("%PDF-1.4 test content"),
      fileName: "knee.pdf",
      mimeType: "application/pdf",
    });
    expect(record.file_url).toContain(patient.id);

    const list = await listPatientRecords(ctx.admin, ctx.admin, owner.id, patient.id, { page: 1, limit: 10 });
    expect(list.items).toHaveLength(1);
    expect(list.items[0].downloadUrl).toContain("http");

    const detail = await getPatientRecordDetails(ctx.admin, ctx.admin, owner.id, patient.id, record.id);
    expect(detail.downloadUrl).toContain("http");
  });

  it("removes the uploaded object if the database insert fails (compensation)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-compensation-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "compensation-owner");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-compensation`));

    const insertSpy = vi.spyOn(patientRecordRepository, "insertPatientRecord").mockRejectedValueOnce(new Error("simulated db failure"));

    await expect(
      createPatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, {
        recordType: "note",
        title: "Test",
        fileBuffer: Buffer.from("%PDF-1.4 test"),
        fileName: "test.pdf",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow("simulated db failure");

    insertSpy.mockRestore();

    const { data: listData, error } = await ctx.admin.storage.from("patient-records").list(`${organization.id}/${patient.id}`);
    expect(error).toBeNull();
    expect(listData).toEqual([]);
  });

  it("scopes record access to clinic-assigned receptionists and the treating physiotherapist", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-scope-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "rec-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-records-scope`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "rec-physio");
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "rec-other");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-records-scope`));

    await expect(
      createPatientRecord(ctx.admin, ctx.admin, otherPhysio.id, patient.id, {
        recordType: "note",
        title: "Unauthorized note",
        fileBuffer: Buffer.from("%PDF-1.4 test"),
        fileName: "n.pdf",
        mimeType: "application/pdf",
      })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );

    const record = await createPatientRecord(ctx.admin, ctx.admin, physio.id, patient.id, {
      recordType: "note",
      title: "Treating physio note",
      fileBuffer: Buffer.from("%PDF-1.4 test"),
      fileName: "n.pdf",
      mimeType: "application/pdf",
    });
    expect(record.uploaded_by).toBe(physio.id);
  });
});
