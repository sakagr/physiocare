import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import { createConsultation } from "@/server/services/consultation.service";
import {
  createPrescription,
  updatePrescription,
  getPrescriptionDetails,
  listOrganizationPrescriptions,
} from "@/server/services/prescription.service";
import {
  validAppointmentInput,
  validClinicInput,
  validConsultationInput,
  validPatientInput,
  validPrescriptionInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Prescription lifecycle", () => {
  const ctx = setupIntegrationContext("prescriptions");

  async function setupConsultation(suffix: string) {
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
    const consultation = await createConsultation(ctx.admin, physio.id, validConsultationInput(appointment.id));
    return { organization, owner, clinic, physio, patient, appointment, consultation };
  }

  it("creates prescriptions copying patient/physiotherapist from the consultation, allows multiple per consultation, and updates them", async () => {
    const { owner, physio, patient, consultation } = await setupConsultation("lifecycle");

    const first = await createPrescription(ctx.admin, physio.id, validPrescriptionInput(consultation.id));
    expect(first.patient_id).toBe(patient.id);
    expect(first.physiotherapist_id).toBe(physio.id);

    const second = await createPrescription(ctx.admin, physio.id, validPrescriptionInput(consultation.id));
    expect(second.id).not.toBe(first.id);

    const updated = await updatePrescription(ctx.admin, physio.id, first.id, { advice: "Updated advice" });
    expect(updated.advice).toBe("Updated advice");

    expect((await getPrescriptionDetails(ctx.admin, owner.id, first.id)).id).toBe(first.id);
  });

  it("only allows the consultation's own physiotherapist or an org admin to create or manage prescriptions", async () => {
    const { organization, owner, consultation } = await setupConsultation("authz");
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "pauthz-other");

    await expect(createPrescription(ctx.admin, otherPhysio.id, validPrescriptionInput(consultation.id))).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });

    const prescription = await createPrescription(ctx.admin, owner.id, validPrescriptionInput(consultation.id));
    await expect(updatePrescription(ctx.admin, otherPhysio.id, prescription.id, { advice: "x" })).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });
  });

  it("scopes prescription listing by caller role", async () => {
    const { organization, owner, clinic, physio, patient, consultation } = await setupConsultation("scope");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "pscope-recep");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);

    const otherClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-pscope-other`));
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "pscope-ophysio");
    await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, otherClinic.id);
    const otherAppointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: otherClinic.id, physiotherapistId: otherPhysio.id })
    );
    const otherConsultation = await createConsultation(ctx.admin, otherPhysio.id, validConsultationInput(otherAppointment.id));

    const prescription = await createPrescription(ctx.admin, physio.id, validPrescriptionInput(consultation.id));
    const otherPrescription = await createPrescription(ctx.admin, otherPhysio.id, validPrescriptionInput(otherConsultation.id));

    const ownerView = await listOrganizationPrescriptions(ctx.admin, owner.id, { page: 1, limit: 50 });
    expect(ownerView.items.map((p) => p.id)).toEqual(expect.arrayContaining([prescription.id, otherPrescription.id]));

    const receptionistView = await listOrganizationPrescriptions(ctx.admin, receptionist.id, { page: 1, limit: 50 });
    expect(receptionistView.items.map((p) => p.id)).toContain(prescription.id);
    expect(receptionistView.items.map((p) => p.id)).not.toContain(otherPrescription.id);

    const physioView = await listOrganizationPrescriptions(ctx.admin, physio.id, { page: 1, limit: 50 });
    expect(physioView.items.map((p) => p.id)).toEqual([prescription.id]);
  });
});
