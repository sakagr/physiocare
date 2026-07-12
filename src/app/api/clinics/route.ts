import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, ErrorCodes } from "@/server/errors";
import { sharedListQuerySchema } from "@/server/validators/shared.validator";
import { validateCreateClinicInput } from "@/server/validators/clinic.validator";
import { listOrganizationClinics } from "@/server/services/clinic.service";
import { createClinic } from "@/server/services/organization.service";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validatedInput = validateCreateClinicInput(body);
    const result = await createClinic(supabase, user.id, validatedInput);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }
    if (error instanceof AppError) {
      if (error.code === ErrorCodes.FORBIDDEN) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
      }
      if (error.code === ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
      }
    }
    console.error("Error creating clinic:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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
    const rawSearch = searchParams.get("search");
    const rawIsActive = searchParams.get("isActive");

    const filters = sharedListQuerySchema.parse({
      page: rawPage === null || rawPage === "" ? undefined : rawPage,
      limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
      search: rawSearch === null ? undefined : rawSearch,
      isActive: rawIsActive === null ? undefined : rawIsActive,
    });

    const result = await listOrganizationClinics(supabase, user.id, filters);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.issues }, { status: 400 });
    }
    if (error instanceof AppError) {
      if (error.code === ErrorCodes.FORBIDDEN) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
      }
    }
    console.error("Error listing clinics:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
