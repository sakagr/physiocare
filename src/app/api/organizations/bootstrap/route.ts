import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canBootstrapOrganization } from "@/server/services/authorization.service";
import { bootstrapOrganization } from "@/server/services/organization.service";
import { AppError, ErrorCodes } from "@/server/errors";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  try {
    // 1. Authenticate the caller
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Authorize the caller
    const isAuthorized = await canBootstrapOrganization(supabase, user.id);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // 3. Delegate to business service
    const adminClient = createAdminClient();
    const result = await bootstrapOrganization(supabase, adminClient, body);

    // 4. Return success response
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request payload", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      if (
        error.code === ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS ||
        error.code === ErrorCodes.EMAIL_ALREADY_EXISTS ||
        error.code === ErrorCodes.USERNAME_ALREADY_EXISTS
      ) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 409 }
        );
      }
    }

    console.error("Error during organization bootstrap:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
