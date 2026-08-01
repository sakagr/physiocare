import { cache } from "react";
import { MutationCache, QueryCache, QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  buildLoginRedirect,
  resolveQueryErrorAction,
  shouldRetryQuery,
  type MutationErrorMeta,
} from "./error-policy";

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
function dispatchErrorAction(error: unknown, meta?: MutationErrorMeta): void {
  const action = resolveQueryErrorAction(error, meta);

  if (action.type === "none") {
    return;
  }

  if (action.type === "redirectLogin") {
    if (typeof window !== "undefined") {
      // Carries the reason and the return path, so the user is told why they
      // are signing in again and lands back where they were.
      window.location.assign(
        buildLoginRedirect(`${window.location.pathname}${window.location.search}`)
      );
    }
    return;
  }

  notifications.show({ color: "danger", message: action.message });
}

/**
 * The cache-level error dispatch, factored out so `renderWithProviders`
 * (F3) can compose it with test-friendly defaults (`retry: false`,
 * `staleTime: 0`) instead of adopting `makeQueryClient()`'s production
 * defaults wholesale -- those would re-enable retries in tests and make
 * error-path assertions slow and flaky.
 */
export function createErrorDispatchCaches(): Pick<QueryClientConfig, "queryCache" | "mutationCache"> {
  return {
    queryCache: new QueryCache({ onError: (error) => dispatchErrorAction(error) }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) =>
        dispatchErrorAction(error, mutation.meta as MutationErrorMeta | undefined),
    }),
  };
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
    ...createErrorDispatchCaches(),
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
