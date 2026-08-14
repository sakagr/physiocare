import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createPackage, deletePackage } from "@/server/services/package.service";
import { createInvoice } from "@/server/services/invoice.service";
import { createPayment } from "@/server/services/payment.service";
import { listOrganizationAuditLogs } from "@/server/services/audit-log.service";
import { validClinicInput, validInvoiceInput, validPackageInput, validPatientInput, validPaymentInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Audit log capture", () => {
  const ctx = setupIntegrationContext("audit-logs");

  it("records entries for patient creation, invoice creation, payment creation, and package deletion", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`));

    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-one`));
    // Billing writes run through a real session client: recordAuditLogSafe
    // swallows its own failures, so an entry asserted only behind the service
    // role would keep passing after auditing had silently stopped.
    const ownerClient = await ctx.signedInClient(owner.email);
    const { invoice } = await createInvoice(ownerClient, owner.id, validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }));
    const payment = await createPayment(ownerClient, owner.id, validPaymentInput(invoice.id));
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-one`));
    await deletePackage(ctx.admin, owner.id, pkg.id);

    const logs = await listOrganizationAuditLogs(ctx.admin, owner.id, { page: 1, limit: 50 });
    const entityNames = logs.items.map((entry) => entry.entity_name);
    expect(entityNames).toContain("patients");
    expect(entityNames).toContain("invoices");
    expect(entityNames).toContain("payments");
    expect(entityNames).toContain("packages");

    const patientEntry = logs.items.find((entry) => entry.entity_name === "patients" && entry.entity_id === patient.id);
    expect(patientEntry).toMatchObject({ action: "create", user_id: owner.id });

    const packageEntry = logs.items.find((entry) => entry.entity_name === "packages" && entry.entity_id === pkg.id);
    expect(packageEntry).toMatchObject({ action: "delete" });

    const invoiceEntry = logs.items.find((entry) => entry.entity_name === "invoices" && entry.entity_id === invoice.id);
    expect(invoiceEntry).toMatchObject({ action: "create", user_id: owner.id });

    const paymentEntry = logs.items.find((entry) => entry.entity_name === "payments" && entry.entity_id === payment.id);
    expect(paymentEntry).toMatchObject({ action: "create", user_id: owner.id });
  });

  it("restricts audit log visibility to ORG_OWNER/ORG_ADMIN", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-restricted-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "restricted-owner");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "restricted-physio");

    await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-restricted`));

    await expect(listOrganizationAuditLogs(ctx.admin, physio.id, { page: 1, limit: 10 })).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
    await expect(listOrganizationAuditLogs(ctx.admin, owner.id, { page: 1, limit: 10 })).resolves.toBeDefined();
  });
});
