import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, ErrorCodes } from "@/server/errors";
import { activatePackage } from "@/server/services/package.service";

export async function POST(
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

    const result = await activatePackage(supabase, user.id, id);
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
    console.error(`Error in POST /api/packages/${id}/activate:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
