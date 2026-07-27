import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import {
  isAuthCallback,
  isAuthRoute,
  isProtectedRoute,
} from "@/lib/auth/route-matchers";

const LOGIN_PATH = "/login";

/**
 * Signed-in users hitting the front door go to the landing resolver, not to a
 * fixed path — it decides the namespace from the user's role. The proxy
 * performs optimistic session redirects only; the route-group layout guard is
 * the actual authorization gate.
 */
const LANDING_PATH = "/";

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

  // Session-required front-door screens (`/reset-password/confirm`,
  // `/invite`) match neither classification, so they fall through untouched
  // in both directions -- their own page guard decides what to render.
  if (user && isAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LANDING_PATH;
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
