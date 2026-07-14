import { NextResponse, type NextRequest } from "next/server";
import { validateCreateInvoiceInput, invoiceListQuerySchema } from "@/server/validators/invoice.validator";
import { createInvoice, listOrganizationInvoices } from "@/server/services/invoice.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreateInvoiceInput(body);
  const result = await createInvoice(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const rawPatientId = searchParams.get("patientId");
  const rawClinicId = searchParams.get("clinicId");

  const filters = invoiceListQuerySchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    patientId: rawPatientId === null ? undefined : rawPatientId,
    clinicId: rawClinicId === null ? undefined : rawClinicId,
  });

  const result = await listOrganizationInvoices(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
