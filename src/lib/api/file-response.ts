import { NextResponse } from "next/server";

/**
 * Wraps a generated file buffer as a downloadable HTTP response. Pure
 * transport -- sets Content-Type/Content-Disposition consistently, no
 * business logic.
 */
export function createFileResponse(buffer: Buffer, filename: string, contentType: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
