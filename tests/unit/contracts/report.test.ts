import { describe, expect, it } from "vitest";
import {
  billingReportSchema,
  commissionReportSchema,
  physiotherapistReportSchema,
} from "@/contracts/report.contract";

/**
 * Response contracts for the Reports domain (F2, M8/R7) -- the 3 JSON
 * report endpoints only; the 3 export routes return binary xlsx/pdf and
 * carry no response schema (registered with `binary` content types
 * instead). Mirrors `billing-report.service.ts` → `BillingReport`,
 * `commission.service.ts` → `CommissionReport`, and
 * `physiotherapist-report.service.ts` → `PhysiotherapistReport` -- each
 * one aggregates existing Invoice/Appointment domain data, introducing no
 * report-specific persistence.
 */
const invoiceFixture = {
  id: "invoice-1",
  organization_id: "org-1",
  invoice_number: "INV-000001",
  patient_id: "patient-1",
  clinic_id: "clinic-1",
  appointment_id: null,
  patient_package_id: null,
  invoice_date: "2026-01-01",
  subtotal: 500,
  gst_amount: 90,
  discount_amount: 0,
  total_amount: 590,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const appointmentFixture = {
  id: "appointment-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  clinic_id: "clinic-1",
  physiotherapist_id: "user-physio",
  appointment_time: "2026-02-01T10:00:00Z",
  appointment_type: "therapy_session",
  status: "completed",
  notes: null,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("billingReportSchema", () => {
  it("parses a billing report (GET /api/reports/billing)", () => {
    const fixture = {
      summary: {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        invoiceCount: 1,
        totalInvoiced: 590,
        totalOutstanding: 590,
        paymentTotalsByStatus: { completed: 0, refunded: 0, cancelled: 0 },
        paymentCountByMode: { card: 0 },
        clinicBreakdown: [
          {
            clinicId: "clinic-1",
            invoiceCount: 1,
            totalInvoiced: 590,
            totalOutstanding: 590,
            paymentTotalsByStatus: { completed: 0, refunded: 0, cancelled: 0 },
          },
        ],
      },
      rows: [{ invoice: invoiceFixture, paymentStatus: null }],
    };
    expect(billingReportSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("commissionReportSchema", () => {
  it("parses a commission report (GET /api/reports/commission)", () => {
    const fixture = {
      summary: {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        totalCompletedAppointments: 4,
        totalCommission: 200,
        physiotherapistBreakdown: [
          {
            physiotherapistId: "user-physio",
            dateFrom: "2026-01-01",
            dateTo: "2026-01-31",
            completedAppointmentCount: 4,
            totalCommission: 200,
          },
        ],
      },
    };
    expect(commissionReportSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("physiotherapistReportSchema", () => {
  it("parses a physiotherapist report (GET /api/reports/physiotherapists)", () => {
    const fixture = {
      summary: {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        appointmentCount: 1,
        appointmentCountsByStatus: { completed: 1 },
        consultationsCompleted: 1,
        attributedRevenue: 590,
        physiotherapistBreakdown: [
          {
            physiotherapistId: "user-physio",
            appointmentCount: 1,
            appointmentCountsByStatus: { completed: 1 },
            consultationsCompleted: 1,
            attributedRevenue: 590,
          },
        ],
      },
      rows: [{ appointment: appointmentFixture, hasConsultation: true, attributedRevenue: 590 }],
    };
    expect(physiotherapistReportSchema.parse(fixture)).toEqual(fixture);
  });
});
