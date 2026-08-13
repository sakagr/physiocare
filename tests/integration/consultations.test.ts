import { describe, expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import {
  createConsultation,
  updateConsultation,
  getConsultationDetails,
  getConsultationForAppointment,
  listOrganizationConsultations,
} from "@/server/services/consultation.service";
import { canManageConsultation, canManagePrescription } from "@/server/services/authorization.service";
import { validAppointmentInput, validClinicInput, validConsultationInput, validPatientInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Consultation lifecycle", () => {
  const ctx = setupIntegrationContext("consultations");

  async function setupAppointment(suffix: string) {
    const organization = await ctx.createOrganization(`${ctx.runId}-${suffix}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-${suffix}`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-physio`);
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-${suffix}`));
    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    return { organization, owner, clinic, physio, patient, appointment };
  }

  it("creates a consultation copying patient/physiotherapist from the appointment, updates it, and enforces the 1:1 constraint", async () => {
    const { owner, physio, patient, appointment } = await setupAppointment("lifecycle");

    const consultation = await createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id));
    expect(consultation.patient_id).toBe(patient.id);
    expect(consultation.physiotherapist_id).toBe(physio.id);

    await expect(createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id))).rejects.toMatchObject({
      code: ErrorCodes.CONSULTATION_ALREADY_EXISTS,
    });

    const updated = await updateConsultation(ctx.admin, physio.id, consultation.id, { diagnosisNotes: "Updated diagnosis" });
    expect(updated.diagnosis_notes).toBe("Updated diagnosis");

    expect((await getConsultationDetails(ctx.admin, owner.id, consultation.id)).id).toBe(consultation.id);
  });

  it("only allows the appointment's own physiotherapist or an org admin to create or manage a consultation", async () => {
    const { organization, owner, appointment } = await setupAppointment("authz");
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "authz-other");

    await expect(createConsultation(ctx.admin, otherPhysio.id, validConsultationInput(appointment.id))).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });

    const consultation = await createConsultation(ctx.admin, owner.id, validConsultationInput(appointment.id));
    await expect(updateConsultation(ctx.admin, otherPhysio.id, consultation.id, { diagnosisNotes: "x" })).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });
  });

  it("scopes consultation listing by caller role", async () => {
    const { organization, owner, clinic, physio, patient, appointment } = await setupAppointment("scope");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "cscope-recep");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);

    const otherClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-cscope-other`));
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "cscope-ophysio");
    await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, otherClinic.id);
    const otherAppointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: otherClinic.id, physiotherapistId: otherPhysio.id })
    );

    const consultation = await createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id));
    const otherConsultation = await createConsultation(ctx.admin, otherPhysio.id, validConsultationInput(otherAppointment.id));

    const ownerView = await listOrganizationConsultations(ctx.admin, owner.id, { page: 1, limit: 50 });
    expect(ownerView.items.map((c) => c.id)).toEqual(expect.arrayContaining([consultation.id, otherConsultation.id]));

    const receptionistView = await listOrganizationConsultations(ctx.admin, receptionist.id, { page: 1, limit: 50 });
    expect(receptionistView.items.map((c) => c.id)).toContain(consultation.id);
    expect(receptionistView.items.map((c) => c.id)).not.toContain(otherConsultation.id);

    const physioView = await listOrganizationConsultations(ctx.admin, physio.id, { page: 1, limit: 50 });
    expect(physioView.items.map((c) => c.id)).toEqual([consultation.id]);
  });

  it("records create and update audit entries against the consultation (F6 task 7, D6)", async () => {
    const { physio, appointment } = await setupAppointment("audit");

    const consultation = await createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id));
    await updateConsultation(ctx.admin, physio.id, consultation.id, { diagnosisNotes: "Lumbar strain" });

    const { data: logs, error } = await ctx.admin
      .from("audit_logs")
      .select("*")
      .eq("entity_id", consultation.id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    expect(logs!.map((log) => log.action)).toEqual(["create", "update"]);
    expect(logs!.every((log) => log.entity_name === "consultations")).toBe(true);
    expect(logs![1].old_data).toMatchObject({ diagnosis_notes: "Muscular strain" });
    expect(logs![1].new_data).toMatchObject({ diagnosis_notes: "Lumbar strain" });
  });

  describe("reading the consultation for an appointment (F6 task 5, D5)", () => {
    it("returns null rather than raising when the visit has not been recorded yet", async () => {
      const { physio, appointment } = await setupAppointment("read-none");

      // "Not started yet" is the normal case on the consultation destination,
      // which is why D5 chose a null body over a 404: a 404 would route the
      // client into the not-found frame per UX.md's error table.
      await expect(getConsultationForAppointment(ctx.admin, physio.id, appointment.id)).resolves.toBeNull();
    });

    it("returns the consultation once it exists", async () => {
      const { physio, patient, appointment } = await setupAppointment("read-some");
      const created = await createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id));

      const found = await getConsultationForAppointment(ctx.admin, physio.id, appointment.id);
      expect(found).toMatchObject({ id: created.id, appointment_id: appointment.id, patient_id: patient.id });
    });

    it("raises NOT_FOUND for an appointment that does not exist", async () => {
      const { physio } = await setupAppointment("read-404");

      await expect(
        getConsultationForAppointment(ctx.admin, physio.id, "00000000-0000-0000-0000-000000000000")
      ).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND });
    });

    it("refuses a physiotherapist reading another physiotherapist's appointment", async () => {
      const { organization, owner, clinic, appointment } = await setupAppointment("read-403");
      const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "read-403-other");
      await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, clinic.id);

      await expect(
        getConsultationForAppointment(ctx.admin, otherPhysio.id, appointment.id)
      ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
    });

    it("admits a receptionist at the appointment's clinic, who may read but not author", async () => {
      const { organization, owner, clinic, physio, appointment } = await setupAppointment("read-recep");
      const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "read-recep-user");
      await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);
      await createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id));

      // Authorization is the appointment's read boundary, not the
      // consultation's: a caller who may see the appointment must be able to
      // learn whether it has a consultation at all.
      await expect(
        getConsultationForAppointment(ctx.admin, receptionist.id, appointment.id)
      ).resolves.toMatchObject({ appointment_id: appointment.id });
    });
  });

  /**
   * The equivalence D14 relies on: the appointment's `canManageConsultation`
   * hint gates the prescription section too, so no second hint is added.
   *
   * It holds because `createConsultation` copies `physiotherapist_id` from the
   * appointment and no input shape can change it afterwards (pinned in
   * tests/unit/validators.test.ts). It is structural but not obvious, so if a
   * later change ever makes that field mutable this fails here rather than the
   * prescription section silently over-permitting.
   */
  it("agrees between canManageConsultation and canManagePrescription for every role (F6, D14)", async () => {
    const { organization, owner, clinic, physio, appointment } = await setupAppointment("d14");
    const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "d14-admin");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "d14-recep");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "d14-physio2");
    await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, clinic.id);

    const consultation = await createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id));

    for (const caller of [owner, admin, physio, receptionist, otherPhysio]) {
      const onAppointment = await canManageConsultation(ctx.admin, caller.id, appointment.id);
      const onConsultation = await canManagePrescription(ctx.admin, caller.id, consultation.id);
      expect(onConsultation, `caller ${caller.id} disagrees across the two predicates`).toBe(onAppointment);
    }

    // Not vacuous: the two predicates must actually differ across callers.
    expect(await canManageConsultation(ctx.admin, physio.id, appointment.id)).toBe(true);
    expect(await canManageConsultation(ctx.admin, otherPhysio.id, appointment.id)).toBe(false);
  });
});
