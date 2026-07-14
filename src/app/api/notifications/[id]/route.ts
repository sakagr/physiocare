import { NextResponse } from "next/server";
import { getNotificationDetails } from "@/server/services/notification.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getNotificationDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
