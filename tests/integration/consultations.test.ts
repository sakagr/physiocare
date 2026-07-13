import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import {
  createConsultation,
  updateConsultation,
  getConsultationDetails,
  listOrganizationConsultations,
} from "@/server/services/consultation.service";
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
});
