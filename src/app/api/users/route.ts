import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCreateOrganizationUserInput } from "@/server/validators/user.validator";
import { canCreateUser } from "@/server/services/authorization.service";
import { createOrganizationUser } from "@/server/services/organization.service";
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

    // 2. Parse request body and validate using Zod validator
    const validatedInput = validateCreateOrganizationUserInput(body);

    // 3. Authorize the caller using validated input role
    const isAuthorized = await canCreateUser(supabase, user.id, validatedInput.role);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // 4. Delegate to business orchestration service
    const adminClient = createAdminClient();
    const result = await createOrganizationUser(supabase, adminClient, user.id, validatedInput);

    // 5. Return success response
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
        error.code === ErrorCodes.EMAIL_ALREADY_EXISTS ||
        error.code === ErrorCodes.USERNAME_ALREADY_EXISTS
      ) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 409 }
        );
      }
    }

    console.error("Error during user onboarding:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
