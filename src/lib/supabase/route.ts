import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

/**
 * The cookie-writing Supabase client, for `/api/auth/*` route handlers only
 * (ADR-0007).
 *
 * `src/lib/supabase/server.ts` deliberately discards the cookies Supabase
 * asks it to set, because the proxy owns session refresh for Server
 * Components. A route that signs a user in, signs them out, or rotates their
 * password must persist those cookies instead — otherwise it authenticates
 * successfully and then silently drops the session. Route Handlers are the
 * one context where `cookies()` is writable, so this is the single module in
 * the codebase that writes session cookies.
 */
export async function createRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
