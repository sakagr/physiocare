import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, ErrorCodes } from "@/server/errors";
import { paginationSchema } from "@/server/validators/shared.validator";
import { listPatientPackageUsage } from "@/server/services/patient-package.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");

    const filters = paginationSchema.parse({
      page: rawPage === null || rawPage === "" ? undefined : rawPage,
      limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    });

    const result = await listPatientPackageUsage(supabase, user.id, id, filters);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.issues }, { status: 400 });
    }
    if (error instanceof AppError) {
      if (error.code === ErrorCodes.FORBIDDEN) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
      }
      if (error.code === ErrorCodes.NOT_FOUND) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
      }
    }
    console.error(`Error in GET /api/patient-packages/${id}/usage:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
