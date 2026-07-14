import { NextResponse } from "next/server";
import { getInvoiceDetails, updateInvoice, deleteInvoice } from "@/server/services/invoice.service";
import { validateUpdateInvoiceInput } from "@/server/validators/invoice.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getInvoiceDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateInvoiceInput(body);
  const result = await updateInvoice(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deleteInvoice(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
