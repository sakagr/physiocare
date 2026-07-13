import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, ErrorCodes } from "@/server/errors";
import { validateUpdatePaymentStatusInput } from "@/server/validators/payment.validator";
import { updatePaymentStatus } from "@/server/services/payment.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const validatedInput = validateUpdatePaymentStatusInput(body);
    const result = await updatePaymentStatus(supabase, user.id, id, validatedInput.status);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }
    if (error instanceof AppError) {
      if (error.code === ErrorCodes.FORBIDDEN) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
      }
      if (error.code === ErrorCodes.NOT_FOUND) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
      }
      if (error.code === ErrorCodes.INVALID_PAYMENT_STATUS_TRANSITION) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
      }
    }
    console.error(`Error in PATCH /api/payments/${id}/status:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
