import { expect, it } from "vitest";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import { createConsultation } from "@/server/services/consultation.service";
import { createPrescription } from "@/server/services/prescription.service";
import { createPatientRecord } from "@/server/services/patient-record.service";
import { createInvoice } from "@/server/services/invoice.service";
import { createPayment } from "@/server/services/payment.service";
import {
  validAppointmentInput,
  validClinicInput,
  validConsultationInput,
  validInvoiceInput,
  validPatientInput,
  validPaymentInput,
  validPrescriptionInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Clinical RLS and tenant isolation", () => {
  const ctx = setupIntegrationContext("clinical-rls");

  async function setupFullOrg(suffix: string) {
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
    const prescription = await createPrescription(ctx.admin, physio.id, validPrescriptionInput(consultation.id));
    const record = await createPatientRecord(ctx.admin, ctx.admin, physio.id, patient.id, {
      recordType: "note",
      title: "note",
      fileBuffer: Buffer.from("%PDF-1.4 x"),
      fileName: "n.pdf",
      mimeType: "application/pdf",
    });
    // The invoice is linked to the appointment so the physiotherapist branch
    // of invoices_select_policy is exercised, not merely present.
    const { invoice, items } = await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      appointmentId: appointment.id,
    });
    const payment = await createPayment(ctx.admin, owner.id, validPaymentInput(invoice.id));
    return {
      organization,
      owner,
      clinic,
      physio,
      patient,
      appointment,
      consultation,
      prescription,
      record,
      invoice,
      invoiceItem: items[0],
      payment,
    };
  }

  it("isolates patients, appointments, consultations, prescriptions, patient records, invoices, invoice items, and payments across organizations", async () => {
    const orgA = await setupFullOrg("iso-a");
    const orgB = await setupFullOrg("iso-b");
    const clientA = await ctx.signedInClient(orgA.owner.email);

    const { data: patients, error: patientsError } = await clientA.from("patients").select("id");
    expect(patientsError).toBeNull();
    expect((patients ?? []).map((p) => p.id)).toContain(orgA.patient.id);
    expect((patients ?? []).map((p) => p.id)).not.toContain(orgB.patient.id);

    const { data: appointments, error: appointmentsError } = await clientA.from("appointments").select("id");
    expect(appointmentsError).toBeNull();
    expect((appointments ?? []).map((a) => a.id)).toContain(orgA.appointment.id);
    expect((appointments ?? []).map((a) => a.id)).not.toContain(orgB.appointment.id);

    const { data: consultations, error: consultationsError } = await clientA.from("consultations").select("id");
    expect(consultationsError).toBeNull();
    expect((consultations ?? []).map((c) => c.id)).toContain(orgA.consultation.id);
    expect((consultations ?? []).map((c) => c.id)).not.toContain(orgB.consultation.id);

    const { data: prescriptions, error: prescriptionsError } = await clientA.from("prescriptions").select("id");
    expect(prescriptionsError).toBeNull();
    expect((prescriptions ?? []).map((p) => p.id)).toContain(orgA.prescription.id);
    expect((prescriptions ?? []).map((p) => p.id)).not.toContain(orgB.prescription.id);

    const { data: records, error: recordsError } = await clientA.from("patient_records").select("id");
    expect(recordsError).toBeNull();
    expect((records ?? []).map((r) => r.id)).toContain(orgA.record.id);
    expect((records ?? []).map((r) => r.id)).not.toContain(orgB.record.id);

    const { data: invoices, error: invoicesError } = await clientA.from("invoices").select("id");
    expect(invoicesError).toBeNull();
    expect((invoices ?? []).map((i) => i.id)).toContain(orgA.invoice.id);
    expect((invoices ?? []).map((i) => i.id)).not.toContain(orgB.invoice.id);

    const { data: invoiceItems, error: invoiceItemsError } = await clientA.from("invoice_items").select("id");
    expect(invoiceItemsError).toBeNull();
    expect((invoiceItems ?? []).map((i) => i.id)).toContain(orgA.invoiceItem.id);
    expect((invoiceItems ?? []).map((i) => i.id)).not.toContain(orgB.invoiceItem.id);

    const { data: payments, error: paymentsError } = await clientA.from("payments").select("id");
    expect(paymentsError).toBeNull();
    expect((payments ?? []).map((p) => p.id)).toContain(orgA.payment.id);
    expect((payments ?? []).map((p) => p.id)).not.toContain(orgB.payment.id);

    const { data: crossOrgUpdate, error: crossOrgUpdateError } = await clientA
      .from("patients")
      .update({ full_name: "Forbidden" })
      .eq("id", orgB.patient.id)
      .select();
    expect(crossOrgUpdateError).toBeNull();
    expect(crossOrgUpdate).toEqual([]);
  });

  it("scopes appointments, consultations, prescriptions, and billing to accessible clinics/own records at the Postgres level, while patients remain org-wide visible", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-scope-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "rls-owner");
    const clinicOne = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-rls-one`));
    const clinicTwo = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-rls-two`));
    const physioOne = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "rls-physio-one");
    const physioTwo = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "rls-physio-two");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "rls-recep");
    await assignUserToClinic(ctx.admin, owner.id, physioOne.id, clinicOne.id);
    await assignUserToClinic(ctx.admin, owner.id, physioTwo.id, clinicTwo.id);
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinicOne.id);

    const patientOne = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-rls-one`));
    const patientTwo = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-rls-two`));
    const appointmentOne = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patientOne.id, clinicId: clinicOne.id, physiotherapistId: physioOne.id })
    );
    const appointmentTwo = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patientTwo.id, clinicId: clinicTwo.id, physiotherapistId: physioTwo.id })
    );
    const consultationOne = await createConsultation(ctx.admin, physioOne.id, validConsultationInput(appointmentOne.id));
    const consultationTwo = await createConsultation(ctx.admin, physioTwo.id, validConsultationInput(appointmentTwo.id));
    const prescriptionOne = await createPrescription(ctx.admin, physioOne.id, validPrescriptionInput(consultationOne.id));
    // The other physiotherapist's prescription must exist for the assertion
    // below to prove it is filtered out rather than simply absent.
    await createPrescription(ctx.admin, physioTwo.id, validPrescriptionInput(consultationTwo.id));

    const invoiceOne = await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patientOne.id, clinicId: clinicOne.id }),
      appointmentId: appointmentOne.id,
    });
    const invoiceTwo = await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patientTwo.id, clinicId: clinicTwo.id }),
      appointmentId: appointmentTwo.id,
    });
    const paymentOne = await createPayment(ctx.admin, owner.id, validPaymentInput(invoiceOne.invoice.id));
    const paymentTwo = await createPayment(ctx.admin, owner.id, validPaymentInput(invoiceTwo.invoice.id));

    const physioOneClient = await ctx.signedInClient(physioOne.email);
    const { data: physioAppointments } = await physioOneClient.from("appointments").select("id");
    expect((physioAppointments ?? []).map((a) => a.id)).toEqual([appointmentOne.id]);
    const { data: physioConsultations } = await physioOneClient.from("consultations").select("id");
    expect((physioConsultations ?? []).map((c) => c.id)).toEqual([consultationOne.id]);
    const { data: physioPrescriptions } = await physioOneClient.from("prescriptions").select("id");
    expect((physioPrescriptions ?? []).map((p) => p.id)).toEqual([prescriptionOne.id]);
    const { data: physioInvoices } = await physioOneClient.from("invoices").select("id");
    expect((physioInvoices ?? []).map((i) => i.id)).toEqual([invoiceOne.invoice.id]);
    const { data: physioInvoiceItems } = await physioOneClient.from("invoice_items").select("id");
    expect((physioInvoiceItems ?? []).map((i) => i.id)).toEqual([invoiceOne.items[0].id]);
    const { data: physioPayments } = await physioOneClient.from("payments").select("id");
    expect((physioPayments ?? []).map((p) => p.id)).toEqual([paymentOne.id]);

    const receptionistClient = await ctx.signedInClient(receptionist.email);
    const { data: receptionistAppointments } = await receptionistClient.from("appointments").select("id");
    const receptionistAppointmentIds = (receptionistAppointments ?? []).map((a) => a.id);
    expect(receptionistAppointmentIds).toContain(appointmentOne.id);
    expect(receptionistAppointmentIds).not.toContain(appointmentTwo.id);

    const { data: receptionistInvoices } = await receptionistClient.from("invoices").select("id");
    const receptionistInvoiceIds = (receptionistInvoices ?? []).map((i) => i.id);
    expect(receptionistInvoiceIds).toContain(invoiceOne.invoice.id);
    expect(receptionistInvoiceIds).not.toContain(invoiceTwo.invoice.id);

    const { data: receptionistInvoiceItems } = await receptionistClient.from("invoice_items").select("id");
    const receptionistInvoiceItemIds = (receptionistInvoiceItems ?? []).map((i) => i.id);
    expect(receptionistInvoiceItemIds).toContain(invoiceOne.items[0].id);
    expect(receptionistInvoiceItemIds).not.toContain(invoiceTwo.items[0].id);

    const { data: receptionistPayments } = await receptionistClient.from("payments").select("id");
    const receptionistPaymentIds = (receptionistPayments ?? []).map((p) => p.id);
    expect(receptionistPaymentIds).toContain(paymentOne.id);
    expect(receptionistPaymentIds).not.toContain(paymentTwo.id);

    const { data: receptionistPatients } = await receptionistClient.from("patients").select("id");
    const receptionistPatientIds = (receptionistPatients ?? []).map((p) => p.id);
    expect(receptionistPatientIds).toContain(patientOne.id);
    expect(receptionistPatientIds).toContain(patientTwo.id);

    const { data: physioPatients } = await physioOneClient.from("patients").select("id");
    const physioPatientIds = (physioPatients ?? []).map((p) => p.id);
    expect(physioPatientIds).toContain(patientOne.id);
    expect(physioPatientIds).toContain(patientTwo.id);
  });

  it("scopes patient record storage objects to accessible organizations/clinics at the Postgres level", async () => {
    const orgA = await setupFullOrg("storage-a");
    const orgB = await setupFullOrg("storage-b");
    const clientA = await ctx.signedInClient(orgA.owner.email);

    const { data: ownList, error: ownListError } = await clientA.storage.from("patient-records").list(`${orgA.organization.id}/${orgA.patient.id}`);
    expect(ownListError).toBeNull();
    expect(ownList?.length).toBeGreaterThan(0);

    const { data: crossOrgSignedUrl, error: crossOrgSignedUrlError } = await clientA.storage
      .from("patient-records")
      .createSignedUrl(orgB.record.file_url, 60);
    expect(crossOrgSignedUrl).toBeNull();
    expect(crossOrgSignedUrlError).not.toBeNull();
  });
});
