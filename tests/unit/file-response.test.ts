import { describe, expect, it } from "vitest";
import { createFileResponse } from "@/lib/api/file-response";

describe("createFileResponse", () => {
  it("sets Content-Type and a download Content-Disposition and returns the buffer as the body", async () => {
    const buffer = Buffer.from("hello world");
    const response = createFileResponse(buffer, "report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="report.xlsx"');

    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(buffer)).toBe(true);
  });
});
