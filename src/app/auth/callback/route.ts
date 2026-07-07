import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

const LOGIN_PATH = "/login";
const DEFAULT_AUTHENTICATED_PATH = "/dashboard";
const RESET_PASSWORD_PATH = "/reset-password";

function getSafeRedirectPath(path: string | null, fallback: string) {
  if (path && path.startsWith("/") && !path.startsWith("//")) {
    return path;
  }
  return fallback;
}

function getRedirectPath(type: string | null, next: string | null) {
  switch (type) {
    case "recovery":
      return RESET_PASSWORD_PATH;
    case "invite":
    case "magiclink":
    case "email":
    case "signup":
      return getSafeRedirectPath(next, DEFAULT_AUTHENTICATED_PATH);
    default:
      return getSafeRedirectPath(next, DEFAULT_AUTHENTICATED_PATH);
  }
}

function redirectToLogin(request: NextRequest, errorCode: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = LOGIN_PATH;
  redirectUrl.search = "";
  redirectUrl.searchParams.set("error", errorCode);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  if (!code && !(tokenHash && type)) {
    return redirectToLogin(request, "auth_callback_missing_params");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const redirectPath = getRedirectPath(type, next);
  let response = NextResponse.redirect(new URL(redirectPath, request.url));

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.redirect(new URL(redirectPath, request.url));

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([header, value]) => {
          response.headers.set(header, value);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToLogin(request, "auth_callback_exchange_failed");
    }
    return response;
  }

  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash!,
  });

  if (error) {
    return redirectToLogin(request, "auth_callback_verify_failed");
  }

  return response;
}
