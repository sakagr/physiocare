import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

const LOGIN_PATH = "/login";
const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

/** Routes that require a signed-in user. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/app",
  "/settings",
  "/patients",
  "/appointments",
  "/clinics",
  "/organizations",
];

/** Auth UI — signed-in users are redirected to the app home. */
const AUTH_ROUTES = ["/login", "/reset-password"];

const AUTH_CALLBACK_PREFIX = "/auth";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return { url, key };
}

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAuthRoute(pathname: string) {
  return matchesRoute(pathname, AUTH_ROUTES);
}

function isAuthCallback(pathname: string) {
  return pathname === AUTH_CALLBACK_PREFIX || pathname.startsWith(`${AUTH_CALLBACK_PREFIX}/`);
}

function isProtectedRoute(pathname: string) {
  return matchesRoute(pathname, PROTECTED_PREFIXES);
}

/** Preserve refreshed session cookies when returning a new response. */
function withSessionCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value }) => {
    target.cookies.set(name, value);
  });
  return target;
}

export async function proxy(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        if (headers) {
          Object.entries(headers).forEach(([header, value]) => {
            response.headers.set(header, value);
          });
        }
      },
    },
  });

  // Validates the JWT and refreshes the session when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isAuthCallback(pathname)) {
    return response;
  }

  if (user && isAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = DEFAULT_AUTHENTICATED_PATH;
    redirectUrl.search = "";
    return withSessionCookies(
      response,
      NextResponse.redirect(redirectUrl),
    );
  }

  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    return withSessionCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on all routes except static assets and images.
     * Session refresh must run on every navigable path.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
