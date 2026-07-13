import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, ErrorCodes } from "@/server/errors";
import { getPatientRecordDetails } from "@/server/services/patient-record.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const result = await getPatientRecordDetails(supabase, adminClient, user.id, id, recordId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === ErrorCodes.FORBIDDEN) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
      }
      if (error.code === ErrorCodes.NOT_FOUND) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
      }
    }
    console.error(`Error in GET /api/patients/${id}/records/${recordId}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
