import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { AppError, ErrorCodes, ERROR_CODE_STATUS } from "@/server/errors";

export interface RouteContext<P> {
  supabase: SupabaseClient<Database>;
  user: User;
  params: P;
}

export type RouteHandler<P = Record<string, never>> = (
  request: NextRequest,
  ctx: RouteContext<P>
) => Promise<NextResponse>;

/**
 * Maps a thrown error to its HTTP response. Shared by every route so error
 * codes are translated to a status consistently instead of per-route.
 */
export function mapErrorToResponse(error: unknown): NextResponse {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request payload", details: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    const status = ERROR_CODE_STATUS[error.code] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

/**
 * Wraps a route handler with authentication and error-to-response mapping.
 * The wrapper must never perform validation. Validation remains the
 * responsibility of validators and route handlers.
 */
export function createRouteHandler<P = Record<string, never>>(handler: RouteHandler<P>) {
  return async (
    request: NextRequest,
    routeCtx?: { params: Promise<P> }
  ): Promise<NextResponse> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const params = routeCtx ? await routeCtx.params : ({} as P);
      return await handler(request, { supabase, user, params });
    } catch (error) {
      return mapErrorToResponse(error);
    }
  };
}

export type PublicRouteHandler<P = Record<string, never>> = (
  request: NextRequest,
  ctx: { params: P }
) => Promise<NextResponse>;

/**
 * Wraps a route handler that must be reachable without a session -- sign-in,
 * sign-out, and requesting a password reset -- with the same error-to-response
 * mapping every other route uses. It is the authentication gate that is
 * dropped here, nothing else: validation and authorization remain the
 * handler's own responsibility.
 */
export function createPublicRouteHandler<P = Record<string, never>>(
  handler: PublicRouteHandler<P>
) {
  return async (
    request: NextRequest,
    routeCtx?: { params: Promise<P> }
  ): Promise<NextResponse> => {
    try {
      const params = routeCtx ? await routeCtx.params : ({} as P);
      return await handler(request, { params });
    } catch (error) {
      return mapErrorToResponse(error);
    }
  };
}

/**
 * Composes a route handler with a caller-level authorization capability
 * check. Delegates the decision to the given predicate -- it never compares
 * role names itself.
 *
 * Named `with...`, not `use...`: this is a higher-order function that wraps a
 * request handler, not a React hook. The `use` prefix is reserved by React's
 * rules of hooks, which is what the previous name violated.
 */
export function withCapability<P = Record<string, never>>(
  capability: (supabase: SupabaseClient<Database>, userId: string) => Promise<boolean>,
  handler: RouteHandler<P>
): RouteHandler<P> {
  return async (request, ctx) => {
    const authorized = await capability(ctx.supabase, ctx.user.id);
    if (!authorized) {
      throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
    }
    return handler(request, ctx);
  };
}
