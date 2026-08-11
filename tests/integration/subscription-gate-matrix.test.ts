import { beforeAll, expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import {
  bootstrapOrganization,
  createOrganizationUser,
  createClinic,
  updateClinic,
  activateClinic,
  assignUserToClinic,
  updateUserProfile,
  changeUserRole,
  activateUser,
} from "@/server/services/organization.service";
import { createPatient, updatePatient, deletePatient } from "@/server/services/patient.service";
import { createPatientRecord } from "@/server/services/patient-record.service";
import {
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
} from "@/server/services/appointment.service";
import { createConsultation, updateConsultation } from "@/server/services/consultation.service";
import { createPrescription, updatePrescription } from "@/server/services/prescription.service";
import {
  createPackage,
  updatePackage,
  activatePackage,
  deactivatePackage,
  deletePackage,
} from "@/server/services/package.service";
import {
  createPatientPackage,
  updatePatientPackage,
  deletePatientPackage,
  consumePackageSession,
  reversePackageSessionConsumption,
  correctPackageSessionUsage,
} from "@/server/services/patient-package.service";
import { createInvoice, updateInvoice, deleteInvoice } from "@/server/services/invoice.service";
import { createPayment, updatePaymentStatus } from "@/server/services/payment.service";
import { recordCheckIn, recordCheckOut, updateAttendance } from "@/server/services/attendance.service";
import { setUserCompensation } from "@/server/services/commission.service";
import { selectSubscriptionPlan } from "@/server/services/subscription.service";
import {
  validOrganizationInput,
  validOrganizationUserInput,
  validClinicInput,
  validPatientInput,
  validAppointmentInput,
  validConsultationInput,
  validPrescriptionInput,
  validPackageInput,
  validPatientPackageInput,
  validInvoiceInput,
  validPaymentInput,
  validAttendanceInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

/**
 * Every write an unsubscribed organization can attempt must be refused
 * (AGENTS.md -> Subscription Principles -> The write/read boundary). At forty
 * call sites, one hand-written assertion per site does not scale, so this is a
 * table.
 *
 * The fixture is built while the organization is subscribed, using the real
 * services, and the subscription is then lapsed underneath it. Every row
 * therefore acts on a record that genuinely exists: a row that fails with
 * NOT_FOUND is reporting a broken fixture, not a moved gate. (The separate
 * arbitrary-UUID test in subscription-enforcement.test.ts is what pins gate
 * ordering for the sites whose gate runs before any resource lookup.)
 *
 * Adding a gated write? Add a row. A gate with no row here is untested.
 */
describeIntegration("Subscription gate matrix", () => {
  const ctx = setupIntegrationContext("gate-matrix");

  const fixture = {
    organizationId: "",
    ownerId: "",
    physioId: "",
    clinicId: "",
    patientId: "",
    appointmentId: "",
    spareAppointmentId: "",
    consultationId: "",
    prescriptionId: "",
    packageId: "",
    patientPackageId: "",
    invoiceId: "",
    paymentId: "",
    attendanceId: "",
  };

  const uniq = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    const input = validOrganizationInput(ctx.runId.slice(-6));
    input.organizationName = `${input.organizationName} ${ctx.runId}-matrix`;
    input.adminEmail = `${ctx.runId}-matrix@example.test`;
    input.adminUsername = `${ctx.runId}-matrix-o`.slice(0, 50);

    const org = await bootstrapOrganization(ctx.admin, ctx.admin, input);
    ctx.trackOrganization(org.organizationId);
    ctx.trackUser(org.adminUserId);
    fixture.organizationId = org.organizationId;
    fixture.ownerId = org.adminUserId;

    // Subscribed: build every record the table acts on through the real services.
    await selectSubscriptionPlan(ctx.admin, fixture.ownerId, fixture.organizationId, "Trial");

    const clinic = await createClinic(ctx.admin, fixture.ownerId, validClinicInput(`${ctx.runId}-matrix`));
    fixture.clinicId = clinic.id;

    const physioInput = validOrganizationUserInput(`${ctx.runId}-matrix`);
    physioInput.username = `${ctx.runId}-matrix-p`.slice(0, 50);
    physioInput.email = `${ctx.runId}-matrix-p@example.test`;
    const physio = await createOrganizationUser(ctx.admin, ctx.admin, fixture.ownerId, physioInput);
    ctx.trackUser(physio.userId);
    fixture.physioId = physio.userId;
    await assignUserToClinic(ctx.admin, fixture.ownerId, fixture.physioId, fixture.clinicId);

    const patient = await createPatient(ctx.admin, fixture.ownerId, validPatientInput(`${ctx.runId}-matrix`));
    fixture.patientId = patient.id;

    const appointmentInput = () =>
      validAppointmentInput({
        patientId: fixture.patientId,
        clinicId: fixture.clinicId,
        physiotherapistId: fixture.physioId,
      });
    fixture.appointmentId = (await createAppointment(ctx.admin, fixture.ownerId, appointmentInput())).id;
    fixture.spareAppointmentId = (await createAppointment(ctx.admin, fixture.ownerId, appointmentInput())).id;

    const consultation = await createConsultation(
      ctx.admin,
      fixture.physioId,
      validConsultationInput(fixture.appointmentId)
    );
    fixture.consultationId = consultation.id;
    fixture.prescriptionId = (
      await createPrescription(ctx.admin, fixture.physioId, validPrescriptionInput(fixture.consultationId))
    ).id;

    const pkg = await createPackage(ctx.admin, fixture.ownerId, validPackageInput(`${ctx.runId}-matrix`));
    fixture.packageId = pkg.id;
    fixture.patientPackageId = (
      await createPatientPackage(
        ctx.admin,
        fixture.ownerId,
        validPatientPackageInput({ patientId: fixture.patientId, packageId: fixture.packageId })
      )
    ).id;

    const { invoice } = await createInvoice(
      ctx.admin,
      fixture.ownerId,
      validInvoiceInput({ patientId: fixture.patientId, clinicId: fixture.clinicId })
    );
    fixture.invoiceId = invoice.id;
    fixture.paymentId = (await createPayment(ctx.admin, fixture.ownerId, validPaymentInput(fixture.invoiceId))).id;

    const attendance = await recordCheckIn(
      ctx.admin,
      fixture.ownerId,
      validAttendanceInput({ clinicId: fixture.clinicId, userId: fixture.physioId })
    );
    fixture.attendanceId = attendance.id;

    // Lapse it. Every row below now acts on a real record in an organization
    // that may no longer be written to.
    const { error } = await ctx.admin
      .from("organizations")
      .update({ subscription_status: "inactive" })
      .eq("id", fixture.organizationId);
    if (error) throw error;
  }, 120_000);

  const GATED_WRITES: Array<{ name: string; run: () => Promise<unknown> }> = [
    // --- New commitments (the nine gated before this scope extension) ---
    {
      name: "createOrganizationUser",
      run: () =>
        createOrganizationUser(ctx.admin, ctx.admin, fixture.ownerId, {
          ...validOrganizationUserInput(uniq()),
          username: `${ctx.runId}-${uniq()}`.slice(0, 50),
          email: `${ctx.runId}-${uniq()}@example.test`,
        }),
    },
    { name: "createClinic", run: () => createClinic(ctx.admin, fixture.ownerId, validClinicInput(uniq())) },
    { name: "createPatient", run: () => createPatient(ctx.admin, fixture.ownerId, validPatientInput(uniq())) },
    {
      name: "createPatientRecord",
      run: () =>
        createPatientRecord(ctx.admin, ctx.admin, fixture.ownerId, fixture.patientId, {
          recordType: "xray",
          title: "Matrix upload",
          fileBuffer: Buffer.from("%PDF-1.4 test content"),
          fileName: "matrix.pdf",
          mimeType: "application/pdf",
        }),
    },
    {
      name: "createAppointment",
      run: () =>
        createAppointment(
          ctx.admin,
          fixture.ownerId,
          validAppointmentInput({
            patientId: fixture.patientId,
            clinicId: fixture.clinicId,
            physiotherapistId: fixture.physioId,
          })
        ),
    },
    {
      name: "createPatientPackage",
      run: () =>
        createPatientPackage(
          ctx.admin,
          fixture.ownerId,
          validPatientPackageInput({ patientId: fixture.patientId, packageId: fixture.packageId })
        ),
    },
    {
      name: "consumePackageSession",
      run: () =>
        consumePackageSession(ctx.admin, fixture.organizationId, fixture.patientPackageId, fixture.spareAppointmentId),
    },
    {
      name: "createInvoice",
      run: () =>
        createInvoice(
          ctx.admin,
          fixture.ownerId,
          validInvoiceInput({ patientId: fixture.patientId, clinicId: fixture.clinicId })
        ),
    },
    { name: "createPayment", run: () => createPayment(ctx.admin, fixture.ownerId, validPaymentInput(fixture.invoiceId)) },

    // --- Cancellations and reversals ---
    { name: "deleteAppointment", run: () => deleteAppointment(ctx.admin, fixture.ownerId, fixture.appointmentId) },
    { name: "deleteInvoice", run: () => deleteInvoice(ctx.admin, fixture.ownerId, fixture.invoiceId) },
    {
      name: "deletePatientPackage",
      run: () => deletePatientPackage(ctx.admin, fixture.ownerId, fixture.patientPackageId),
    },
    {
      name: "updatePatientPackage (cancellation)",
      run: () => updatePatientPackage(ctx.admin, fixture.ownerId, fixture.patientPackageId, { status: "cancelled" }),
    },
    {
      name: "updatePatientPackage (validity extension)",
      run: () =>
        updatePatientPackage(ctx.admin, fixture.ownerId, fixture.patientPackageId, {
          extendedValidityTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        }),
    },
    {
      name: "updatePaymentStatus",
      run: () => updatePaymentStatus(ctx.admin, fixture.ownerId, fixture.paymentId, "refunded"),
    },
    {
      name: "reversePackageSessionConsumption",
      run: () => reversePackageSessionConsumption(ctx.admin, fixture.organizationId, fixture.appointmentId),
    },
    {
      name: "correctPackageSessionUsage",
      run: () => correctPackageSessionUsage(ctx.admin, fixture.ownerId, fixture.appointmentId),
    },

    // --- Delivering a visit ---
    {
      name: "updateAppointmentStatus",
      run: () => updateAppointmentStatus(ctx.admin, fixture.ownerId, fixture.appointmentId, { status: "completed" }),
    },
    {
      name: "createConsultation",
      run: () => createConsultation(ctx.admin, fixture.physioId, validConsultationInput(fixture.spareAppointmentId)),
    },
    {
      name: "updateConsultation",
      run: () => updateConsultation(ctx.admin, fixture.physioId, fixture.consultationId, { painScale: 3 }),
    },
    {
      name: "createPrescription",
      run: () => createPrescription(ctx.admin, fixture.physioId, validPrescriptionInput(fixture.consultationId)),
    },
    {
      name: "updatePrescription",
      run: () => updatePrescription(ctx.admin, fixture.physioId, fixture.prescriptionId, { advice: "Rest" }),
    },
    {
      name: "recordCheckIn",
      run: () =>
        recordCheckIn(ctx.admin, fixture.ownerId, validAttendanceInput({ clinicId: fixture.clinicId, userId: fixture.ownerId })),
    },
    { name: "recordCheckOut", run: () => recordCheckOut(ctx.admin, fixture.ownerId, fixture.attendanceId) },
    {
      name: "updateAttendance",
      run: () => updateAttendance(ctx.admin, fixture.ownerId, fixture.attendanceId, { status: "absent" }),
    },

    // --- Editing existing records ---
    {
      name: "updateAppointment",
      run: () =>
        updateAppointment(ctx.admin, fixture.ownerId, fixture.appointmentId, { appointmentType: "follow_up" }),
    },
    {
      name: "updateInvoice",
      run: () => updateInvoice(ctx.admin, fixture.ownerId, fixture.invoiceId, { discountAmount: 10 }),
    },
    {
      name: "updatePatient",
      run: () => updatePatient(ctx.admin, fixture.ownerId, fixture.patientId, { fullName: "Renamed Patient" }),
    },
    { name: "deletePatient", run: () => deletePatient(ctx.admin, fixture.ownerId, fixture.patientId) },
    {
      name: "updateClinic",
      run: () => updateClinic(ctx.admin, fixture.ownerId, fixture.clinicId, { clinicName: `Renamed ${uniq()}` }),
    },
    { name: "activateClinic", run: () => activateClinic(ctx.admin, fixture.ownerId, fixture.clinicId) },
    {
      name: "assignUserToClinic",
      run: () => assignUserToClinic(ctx.admin, fixture.ownerId, fixture.physioId, fixture.clinicId),
    },
    {
      name: "updateUserProfile",
      run: () => updateUserProfile(ctx.admin, fixture.ownerId, fixture.physioId, { fullName: "Renamed Physio" }),
    },
    {
      name: "changeUserRole",
      run: () => changeUserRole(ctx.admin, fixture.ownerId, fixture.physioId, "ORG_RECEPTIONIST"),
    },
    { name: "activateUser", run: () => activateUser(ctx.admin, ctx.admin, fixture.ownerId, fixture.physioId) },
    {
      name: "setUserCompensation",
      run: () => setUserCompensation(ctx.admin, fixture.ownerId, fixture.physioId, { type: "percentage", value: 10 }),
    },

    // --- The package catalog ---
    { name: "createPackage", run: () => createPackage(ctx.admin, fixture.ownerId, validPackageInput(uniq())) },
    {
      name: "updatePackage",
      run: () => updatePackage(ctx.admin, fixture.ownerId, fixture.packageId, { packagePrice: 6000 }),
    },
    { name: "activatePackage", run: () => activatePackage(ctx.admin, fixture.ownerId, fixture.packageId) },
    { name: "deactivatePackage", run: () => deactivatePackage(ctx.admin, fixture.ownerId, fixture.packageId) },
    { name: "deletePackage", run: () => deletePackage(ctx.admin, fixture.ownerId, fixture.packageId) },
  ];

  it.each(GATED_WRITES)("refuses $name", async ({ run }) => {
    await expect(run()).rejects.toMatchObject({ code: ErrorCodes.SUBSCRIPTION_REQUIRED });
  });

  it("covers every gated write exactly once", () => {
    const names = GATED_WRITES.map((row) => row.name);
    expect(new Set(names).size).toBe(names.length);
    // 41 rows, 40 functions: updatePatientPackage carries two rows (cancellation
    // and validity extension) because the decision names both explicitly.
    expect(names).toHaveLength(41);
  });
});
