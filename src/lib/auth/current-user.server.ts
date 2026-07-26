import { cache } from "react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/api-error";
import type { CurrentUser } from "@/types/contracts/me";

/**
 * Server-side access to the current user, for the route-group layouts that
 * enforce the namespace guard and seed the shell.
 *
 * It goes through the isomorphic API client rather than calling the service
 * directly: `/api` is the single contract, and a direct service call would
 * create a second authorization path that can drift from the route handler
 * (AGENTS.md → Backend Communication).
 *
 * Wrapped in React `cache()` so every Server Component in one request shares
 * a single `/me` fetch, however many of them ask.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    return await api.get<CurrentUser>("/api/users/me");
  } catch (error) {
    // No session, or a profile the API will not serve: both mean "not signed
    // in" as far as the shell is concerned. Anything else is a real fault and
    // should surface rather than silently log the user out.
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
});
