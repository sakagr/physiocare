import { describe, expect, it } from "vitest";
import {
  billingReportQuerySchema,
  physiotherapistReportQuerySchema,
  exportFormatSchema,
  MAX_REPORT_RANGE_DAYS,
} from "@/server/validators/report.validator";

describe("report validators", () => {
  it("accepts a valid billing report date range", () => {
    const result = billingReportQuerySchema.parse({ dateFrom: "2026-01-01", dateTo: "2026-01-31" });
    expect(result.dateFrom).toBe("2026-01-01");
    expect(result.dateTo).toBe("2026-01-31");
  });

  it("rejects a range where dateTo precedes dateFrom", () => {
    expect(() => billingReportQuerySchema.parse({ dateFrom: "2026-01-31", dateTo: "2026-01-01" })).toThrow();
  });

  it("rejects a range exceeding the maximum allowed days", () => {
    const from = new Date("2026-01-01");
    const to = new Date(from);
    to.setDate(to.getDate() + MAX_REPORT_RANGE_DAYS + 1);

    expect(() =>
      billingReportQuerySchema.parse({ dateFrom: "2026-01-01", dateTo: to.toISOString().slice(0, 10) })
    ).toThrow();
  });

  it("accepts a range exactly at the maximum allowed days", () => {
    const from = new Date("2026-01-01");
    const to = new Date(from);
    to.setDate(to.getDate() + MAX_REPORT_RANGE_DAYS);

    expect(() =>
      billingReportQuerySchema.parse({ dateFrom: "2026-01-01", dateTo: to.toISOString().slice(0, 10) })
    ).not.toThrow();
  });

  it("accepts an optional clinicId filter on the billing report query", () => {
    const result = billingReportQuerySchema.parse({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      clinicId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.clinicId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("rejects a malformed clinicId", () => {
    expect(() =>
      billingReportQuerySchema.parse({ dateFrom: "2026-01-01", dateTo: "2026-01-31", clinicId: "not-a-uuid" })
    ).toThrow();
  });

  it("accepts an optional physiotherapistId filter on the physiotherapist report query", () => {
    const result = physiotherapistReportQuerySchema.parse({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      physiotherapistId: "00000000-0000-4000-8000-000000000002",
    });
    expect(result.physiotherapistId).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("rejects a physiotherapist report range exceeding the maximum allowed days", () => {
    const from = new Date("2026-01-01");
    const to = new Date(from);
    to.setDate(to.getDate() + MAX_REPORT_RANGE_DAYS + 1);

    expect(() =>
      physiotherapistReportQuerySchema.parse({ dateFrom: "2026-01-01", dateTo: to.toISOString().slice(0, 10) })
    ).toThrow();
  });

  it("accepts xlsx and pdf export formats and rejects anything else", () => {
    expect(exportFormatSchema.parse("xlsx")).toBe("xlsx");
    expect(exportFormatSchema.parse("pdf")).toBe("pdf");
    expect(() => exportFormatSchema.parse("csv")).toThrow();
  });
});
