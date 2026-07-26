import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCreateOrganizationUserInput } from "@/server/validators/user.validator";
import { canCreateUser } from "@/server/services/authorization.service";
import { createOrganizationUser } from "@/server/services/organization.service";
import { AppError, ErrorCodes } from "@/server/errors";
import { sharedListQuerySchema } from "@/server/validators/shared.validator";
import { listOrganizationUsers } from "@/server/services/user.service";
import { createRouteHandler } from "@/lib/api/route-handler";
import type { AppRole } from "@/server/repositories/user.repository";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreateOrganizationUserInput(body);

  // Authorization depends on the validated target role, so it cannot run as
  // a caller-only route guard -- delegates to the same centralized predicate.
  const isAuthorized = await canCreateUser(supabase, user.id, validatedInput.role);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const adminClient = createAdminClient();
  const result = await createOrganizationUser(supabase, adminClient, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const rawSearch = searchParams.get("search");
  const rawIsActive = searchParams.get("isActive");
  const rawRole = searchParams.get("role");

  const parsedFilters = sharedListQuerySchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    search: rawSearch === null ? undefined : rawSearch,
    isActive: rawIsActive === null ? undefined : rawIsActive,
  });

  // Transport normalization belongs in the route, not the validator: an absent
  // or empty `role` means "no role filter". An unrecognized value is passed
  // through as-is and simply matches no rows, which is the existing behavior.
  const filters = {
    ...parsedFilters,
    role:
      rawRole === null || rawRole === "" ? undefined : (rawRole as AppRole),
  };

  const result = await listOrganizationUsers(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
