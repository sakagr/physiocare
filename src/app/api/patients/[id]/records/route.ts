import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sharedListQuerySchema } from "@/server/validators/shared.validator";
import { validateCreatePatientRecordInput } from "@/server/validators/patient-record.validator";
import { createPatientRecord, listPatientRecords } from "@/server/services/patient-record.service";
import { createRouteHandler } from "@/lib/api/route-handler";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart payload" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds the maximum allowed size of 20MiB" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }

  const validatedInput = validateCreatePatientRecordInput({
    recordType: formData.get("recordType"),
    title: formData.get("title"),
    notes: formData.get("notes") ?? undefined,
  });

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const adminClient = createAdminClient();
  const result = await createPatientRecord(supabase, adminClient, user.id, params.id, {
    ...validatedInput,
    fileBuffer,
    fileName: file.name,
    mimeType: file.type,
  });
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler<{ id: string }>(async (request: NextRequest, { supabase, user, params }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");

  const filters = sharedListQuerySchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
  });

  const adminClient = createAdminClient();
  const result = await listPatientRecords(supabase, adminClient, user.id, params.id, filters);
  return NextResponse.json(result, { status: 200 });
});
