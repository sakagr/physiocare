import { NextResponse, type NextRequest } from "next/server";
import { validateCreateNotificationInput, notificationListQuerySchema } from "@/server/validators/notification.validator";
import { createNotification, listOrganizationNotifications } from "@/server/services/notification.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreateNotificationInput(body);
  const result = await createNotification(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = notificationListQuerySchema.parse({
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
    userId: searchParams.get("userId") || undefined,
    patientId: searchParams.get("patientId") || undefined,
    status: searchParams.get("status") || undefined,
  });

  const result = await listOrganizationNotifications(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
