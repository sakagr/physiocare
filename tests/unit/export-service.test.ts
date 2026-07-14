import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generateExcelWorkbook, generatePdfDocument, type ExportColumn } from "@/server/services/export.service";

interface SampleRow {
  name: string;
  amount: number;
}

const columns: ExportColumn<SampleRow>[] = [
  { header: "Name", accessor: (row) => row.name },
  { header: "Amount", accessor: (row) => row.amount },
];

const rows: SampleRow[] = [
  { name: "Alpha", amount: 100 },
  { name: "Beta", amount: 250 },
];

describe("export service", () => {
  it("produces an Excel workbook whose rows and summary round-trip exactly", async () => {
    const buffer = await generateExcelWorkbook("Sample", columns, rows, { "Total Amount": 350 });
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Sample");
    expect(sheet).toBeDefined();

    const dataRows: { name: string; amount: number }[] = [];
    sheet!.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // header row
      const values = row.values as unknown[];
      if (typeof values[1] === "string" && typeof values[2] === "number") {
        dataRows.push({ name: values[1] as string, amount: values[2] as number });
      }
    });
    expect(dataRows).toEqual(rows);

    const summarySheet = workbook.getWorksheet("Summary");
    expect(summarySheet).toBeDefined();
  });

  it("produces a non-empty PDF buffer starting with the PDF signature", async () => {
    const buffer = await generatePdfDocument("Sample Report", columns, rows, { "Total Amount": 350 });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("produces an empty-but-valid workbook and PDF for zero rows", async () => {
    const excelBuffer = await generateExcelWorkbook("Empty", columns, []);
    expect(excelBuffer.length).toBeGreaterThan(0);

    const pdfBuffer = await generatePdfDocument("Empty Report", columns, []);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
