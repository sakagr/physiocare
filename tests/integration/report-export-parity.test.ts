import { expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import { transitionAppointmentStatus } from "@/server/services/appointment-workflow.service";
import { createInvoice } from "@/server/services/invoice.service";
import { createPayment } from "@/server/services/payment.service";
import {
  getBillingReport,
  BILLING_REPORT_EXPORT_COLUMNS,
  buildBillingReportExportSummary,
} from "@/server/services/billing-report.service";
import {
  getPhysiotherapistReport,
  PHYSIOTHERAPIST_REPORT_EXPORT_COLUMNS,
  buildPhysiotherapistReportExportSummary,
} from "@/server/services/physiotherapist-report.service";
import {
  setUserCompensation,
  getCommissionReport,
  COMMISSION_REPORT_EXPORT_COLUMNS,
  buildCommissionReportExportSummary,
} from "@/server/services/commission.service";
import { generateExcelWorkbook } from "@/server/services/export.service";
import { validClinicInput, validPatientInput, validAppointmentInput, validInvoiceInput, validPaymentInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

async function readWorksheetRows(buffer: Buffer, sheetName: string): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    rows.push((row.values as unknown[]).slice(1));
  });
  return rows;
}

describeIntegration("Report export parity", () => {
  const ctx = setupIntegrationContext("export-parity");

  it("the billing export represents exactly the same rows and summary as the JSON report", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-one`));

    const invoiceOne = await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-02-10",
    });
    await createPayment(ctx.admin, owner.id, { ...validPaymentInput(invoiceOne.invoice.id), paidAt: "2026-02-11T10:00:00.000Z" });

    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-02-12",
    });

    const jsonReport = await getBillingReport(ctx.admin, owner.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });

    const summary = buildBillingReportExportSummary(jsonReport.summary);
    const excelBuffer = await generateExcelWorkbook("Billing Report", BILLING_REPORT_EXPORT_COLUMNS, jsonReport.rows, summary);

    const exportedRows = await readWorksheetRows(excelBuffer, "Billing Report");
    expect(exportedRows).toHaveLength(jsonReport.rows.length);

    const exportedInvoiceNumbers = exportedRows.map((row) => row[0]).sort();
    const jsonInvoiceNumbers = jsonReport.rows.map((row) => row.invoice.invoice_number).sort();
    expect(exportedInvoiceNumbers).toEqual(jsonInvoiceNumbers);

    const exportedTotals = exportedRows.map((row) => row[3]);
    expect(exportedTotals.reduce((sum: number, v) => sum + Number(v), 0)).toBe(jsonReport.summary.totalInvoiced);

    const summaryRows = await readWorksheetRows(excelBuffer, "Summary");
    const summaryMap = new Map(summaryRows.map((row) => [row[0], row[1]]));
    expect(summaryMap.get("Invoice Count")).toBe(jsonReport.summary.invoiceCount);
    expect(summaryMap.get("Total Invoiced")).toBe(jsonReport.summary.totalInvoiced);
    expect(summaryMap.get("Total Outstanding")).toBe(jsonReport.summary.totalOutstanding);
    expect(summaryMap.get("Total Collected")).toBe(jsonReport.summary.paymentTotalsByStatus.completed);
  });

  it("the physiotherapist export represents exactly the same rows and summary as the JSON report", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-physio-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "physio-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-physio`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "physio-p");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-physio`));

    const appointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: "2026-02-10T09:00:00.000Z",
    });
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      appointmentId: appointment.id,
      invoiceDate: "2026-02-10",
    });

    const jsonReport = await getPhysiotherapistReport(ctx.admin, owner.id, {
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      physiotherapistId: physio.id,
    });

    const summary = buildPhysiotherapistReportExportSummary(jsonReport.summary);
    const excelBuffer = await generateExcelWorkbook(
      "Physiotherapist Report",
      PHYSIOTHERAPIST_REPORT_EXPORT_COLUMNS,
      jsonReport.rows,
      summary
    );

    const exportedRows = await readWorksheetRows(excelBuffer, "Physiotherapist Report");
    expect(exportedRows).toHaveLength(jsonReport.rows.length);

    const exportedRevenue = exportedRows.reduce((sum: number, row) => sum + Number(row[4]), 0);
    expect(exportedRevenue).toBe(jsonReport.summary.attributedRevenue);

    const summaryRows = await readWorksheetRows(excelBuffer, "Summary");
    const summaryMap = new Map(summaryRows.map((row) => [row[0], row[1]]));
    expect(summaryMap.get("Appointment Count")).toBe(jsonReport.summary.appointmentCount);
    expect(summaryMap.get("Attributed Revenue")).toBe(jsonReport.summary.attributedRevenue);
  });

  it("the commission export represents exactly the same rows and summary as the JSON report", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-comm-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "comm-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-comm`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "comm-p");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-comm`));
    await setUserCompensation(ctx.admin, owner.id, physio.id, { type: "percentage", value: 10, effectiveFrom: "2026-01-01" });

    const appointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: "2026-02-10T09:00:00.000Z",
    });
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      appointmentId: appointment.id,
      invoiceDate: "2026-02-10",
    });
    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "confirmed" });
    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "checked_in" });
    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed" });

    const jsonReport = await getCommissionReport(ctx.admin, owner.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });

    const summary = buildCommissionReportExportSummary(jsonReport.summary);
    const excelBuffer = await generateExcelWorkbook(
      "Commission Report",
      COMMISSION_REPORT_EXPORT_COLUMNS,
      jsonReport.summary.physiotherapistBreakdown,
      summary
    );

    const exportedRows = await readWorksheetRows(excelBuffer, "Commission Report");
    expect(exportedRows).toHaveLength(jsonReport.summary.physiotherapistBreakdown.length);

    const exportedCommission = exportedRows.reduce((sum: number, row) => sum + Number(row[2]), 0);
    expect(exportedCommission).toBeCloseTo(jsonReport.summary.totalCommission, 5);

    const summaryRows = await readWorksheetRows(excelBuffer, "Summary");
    const summaryMap = new Map(summaryRows.map((row) => [row[0], row[1]]));
    expect(summaryMap.get("Total Completed Appointments")).toBe(jsonReport.summary.totalCompletedAppointments);
    expect(summaryMap.get("Total Commission")).toBe(jsonReport.summary.totalCommission);
  });
});
