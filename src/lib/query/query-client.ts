import { cache } from "react";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { resolveQueryErrorAction, shouldRetryQuery } from "./error-policy";

/**
 * TanStack Query is the server-state manager (AGENTS.md → Rendering and
 * Server State). This module owns its construction in both environments:
 * a browser singleton, and a per-request client on the server so one
 * request's data never leaks into another's.
 */

const STALE_TIME_MS = 60_000;

/**
 * Performs the cross-cutting action the error policy decided on. Runs from a
 * cache callback, outside React, so navigation uses a full location change
 * rather than a router the callback has no access to.
 */
function dispatchErrorAction(error: unknown): void {
  const action = resolveQueryErrorAction(error);

  if (action.type === "none") {
    return;
  }

  if (action.type === "redirectLogin") {
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
    return;
  }

  notifications.show({ color: "danger", message: action.message });
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({ onError: dispatchErrorAction }),
    mutationCache: new MutationCache({ onError: dispatchErrorAction }),
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Returns the QueryClient for the current environment: one shared instance in
 * the browser, and a fresh per-request instance on the server, memoized by
 * React `cache()` so everything rendering one request shares it.
 */
export const getQueryClient: () => QueryClient =
  typeof window === "undefined"
    ? cache(makeQueryClient)
    : () => (browserQueryClient ??= makeQueryClient());
