import { NextResponse } from "next/server";
import { createPaymentSchema } from "@/server/validators/payment.validator";
import { createPayment, listPaymentsForInvoice } from "@/server/services/payment.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = createPaymentSchema.parse({ ...body, invoiceId: params.id });
  const result = await createPayment(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await listPaymentsForInvoice(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
