import { expect, it, vi } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import {
  createPatientRecord,
  listPatientRecords,
  getPatientRecordDetails,
  deletePatientRecord,
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

  it("scopes record access to the treating physiotherapist, in the predicate and in RLS", async () => {
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

    // Through the treating physiotherapist's own session client, so the
    // assertion covers the RLS branch as well as the predicate. Both policy
    // rewrites copy the physiotherapist branch through unchanged; if a future
    // sweep drops it, the predicate would still say yes and this list would
    // silently come back empty.
    const physioClient = await ctx.signedInClient(physio.email);
    const physioView = await listPatientRecords(physioClient, ctx.admin, physio.id, patient.id, { page: 1, limit: 10 });
    expect(physioView.items.map((item) => item.id)).toContain(record.id);

    const otherPhysioClient = await ctx.signedInClient(otherPhysio.email);
    await expect(
      listPatientRecords(otherPhysioClient, ctx.admin, otherPhysio.id, patient.id, { page: 1, limit: 10 })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("lets an unassigned receptionist upload and read records for a patient with no appointments", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-intake-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "intake-owner");
    // Deliberately assigned to no clinic and given no appointment: this is
    // UX.md Flow 4's intake desk, where Reception creates the patient and
    // attaches the first scans before any appointment exists.
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "intake-reception");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-intake`));

    // A real signed-in session client, not ctx.admin: the service-role client
    // bypasses RLS, so an admin-client test would pass with only the predicate
    // half of this change applied and would prove nothing about the half that
    // actually breaks the feature.
    const receptionClient = await ctx.signedInClient(receptionist.email);

    const record = await createPatientRecord(receptionClient, ctx.admin, receptionist.id, patient.id, {
      recordType: "xray",
      title: "Intake X-Ray",
      fileBuffer: Buffer.from("%PDF-1.4 intake"),
      fileName: "intake.pdf",
      mimeType: "application/pdf",
    });

    const list = await listPatientRecords(receptionClient, ctx.admin, receptionist.id, patient.id, { page: 1, limit: 10 });
    expect(list.items.map((item) => item.id)).toEqual([record.id]);

    const detail = await getPatientRecordDetails(receptionClient, ctx.admin, receptionist.id, patient.id, record.id);
    expect(detail.title).toBe("Intake X-Ray");
  });

  it("soft-deletes a record, removes its Storage object, and keeps list and count in agreement", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-delete-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "delete-owner");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-delete`));

    const doomed = await createPatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, {
      recordType: "xray",
      title: "Misfiled scan",
      fileBuffer: Buffer.from("%PDF-1.4 misfiled"),
      fileName: "misfiled.pdf",
      mimeType: "application/pdf",
    });
    const kept = await createPatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, {
      recordType: "note",
      title: "Correct note",
      fileBuffer: Buffer.from("%PDF-1.4 correct"),
      fileName: "correct.pdf",
      mimeType: "application/pdf",
    });

    const deleted = await deletePatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, doomed.id);
    expect(deleted.deleted_at).not.toBeNull();

    const list = await listPatientRecords(ctx.admin, ctx.admin, owner.id, patient.id, { page: 1, limit: 10 });
    expect(list.items.map((item) => item.id)).toEqual([kept.id]);
    // The pagination total must agree with the list, or the last page is short.
    expect(list.total).toBe(1);

    await expect(
      getPatientRecordDetails(ctx.admin, ctx.admin, owner.id, patient.id, doomed.id)
    ).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND });

    // The row is the audit trail; the file is the payload. A soft delete that
    // left the misfiled scan in the bucket would not fix what this exists for.
    const { data: objects } = await ctx.admin.storage.from("patient-records").list(`${organization.id}/${patient.id}`);
    expect((objects ?? []).map((object) => `${organization.id}/${patient.id}/${object.name}`)).toEqual([kept.file_url]);
  });

  it("refuses a receptionist's delete even though a receptionist may upload", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-delete-scope-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "delete-scope-owner");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "delete-scope-reception");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-delete-scope`));

    const record = await createPatientRecord(ctx.admin, ctx.admin, receptionist.id, patient.id, {
      recordType: "xray",
      title: "Reception upload",
      fileBuffer: Buffer.from("%PDF-1.4 reception"),
      fileName: "reception.pdf",
      mimeType: "application/pdf",
    });

    // Deliberate asymmetry: canDeletePatientRecords is ORG_MANAGEMENT_ROLES,
    // narrower than the manage predicate that admits Reception. Destroying a
    // record is a different act from creating one.
    await expect(
      deletePatientRecord(ctx.admin, ctx.admin, receptionist.id, patient.id, record.id)
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("writes an audit entry for each record write, snapshotting what a delete destroys", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-record-audit-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "record-audit-owner");
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-record-audit`));

    const record = await createPatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, {
      recordType: "mri",
      title: "Audited scan",
      fileBuffer: Buffer.from("%PDF-1.4 audited"),
      fileName: "audited.pdf",
      mimeType: "application/pdf",
    });
    await deletePatientRecord(ctx.admin, ctx.admin, owner.id, patient.id, record.id);

    const { data: entries } = await ctx.admin
      .from("audit_logs")
      .select("action, entity_name, entity_id, old_data, new_data")
      .eq("entity_id", record.id)
      .order("created_at", { ascending: true });

    expect((entries ?? []).map((entry) => entry.action)).toEqual(["create", "delete"]);
    expect(entries?.[0]).toMatchObject({ entity_name: "patient_records" });
    expect(entries?.[0].new_data).toMatchObject({ title: "Audited scan" });

    // The audit row is the only surviving trace of the document: the Storage
    // object is gone, so file_url is what ties this entry to storage-level
    // logs and backups.
    expect(entries?.[1].old_data).toMatchObject({
      file_url: record.file_url,
      title: "Audited scan",
      record_type: "mri",
      uploaded_by: owner.id,
      created_at: record.created_at,
    });
  });
});
