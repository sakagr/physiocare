import { NextResponse, type NextRequest } from "next/server";
import { consultationListQuerySchema } from "@/server/validators/consultation.validator";
import { listOrganizationConsultations } from "@/server/services/consultation.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const rawPatientId = searchParams.get("patientId");

  const filters = consultationListQuerySchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    patientId: rawPatientId === null ? undefined : rawPatientId,
  });

  const result = await listOrganizationConsultations(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
