import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPatientRecordDetails, deletePatientRecord } from "@/server/services/patient-record.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string; recordId: string }>(async (request, { supabase, user, params }) => {
  const adminClient = createAdminClient();
  const result = await getPatientRecordDetails(supabase, adminClient, user.id, params.id, params.recordId);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string; recordId: string }>(async (request, { supabase, user, params }) => {
  const adminClient = createAdminClient();
  const result = await deletePatientRecord(supabase, adminClient, user.id, params.id, params.recordId);
  return NextResponse.json(result, { status: 200 });
});
