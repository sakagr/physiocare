import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

/**
 * Deliberately knows nothing about invoices, appointments, or organizations
 * -- it only turns already-fetched, already-authorized rows into a file.
 * Callers (report services) own every business decision about what a
 * column means; this module only formats.
 */
export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/**
 * Renders columns/rows as an .xlsx workbook, with an optional second
 * "Summary" sheet of key/value pairs.
 */
export async function generateExcelWorkbook<T>(
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  summary?: Record<string, string | number>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(columns.map((column) => column.header));
  for (const row of rows) {
    sheet.addRow(columns.map((column) => column.accessor(row)));
  }

  if (summary) {
    const summarySheet = workbook.addWorksheet("Summary");
    for (const [key, value] of Object.entries(summary)) {
      summarySheet.addRow([key, value]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Renders a title, an optional summary block, and a plain columns/rows
 * table as a PDF document.
 */
export function generatePdfDocument<T>(
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
  summary?: Record<string, string | number>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title);
    doc.moveDown();

    if (summary) {
      doc.fontSize(10);
      for (const [key, value] of Object.entries(summary)) {
        doc.text(`${key}: ${value}`);
      }
      doc.moveDown();
    }

    doc.fontSize(9);
    doc.text(columns.map((column) => column.header).join("  |  "));
    doc.moveDown(0.5);
    for (const row of rows) {
      doc.text(columns.map((column) => String(column.accessor(row))).join("  |  "));
    }

    doc.end();
  });
}
