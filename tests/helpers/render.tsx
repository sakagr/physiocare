import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { theme } from "@/lib/theme";
import { createErrorDispatchCaches } from "@/lib/query/query-client";
import { CurrentUserProvider } from "@/lib/auth/current-user-context";
import type { CurrentUser } from "@/types/contracts/me";
import { currentUserFixtures } from "./current-user";

/**
 * The entry point for every component test in the app. It mounts close to
 * the same provider tree the real application does — theme, server state,
 * current user, and (F3) the notification system and the cache-level error
 * dispatch — so a test exercises components under the conditions they
 * actually run in, including a failing mutation surfacing as a toast.
 *
 * It deliberately does **not** match production exactly in three ways:
 *  - `retry: false` / `staleTime: 0` — `makeQueryClient()`'s production
 *    defaults (`retry: shouldRetryQuery`, `staleTime: 60_000`) would re-enable
 *    retries here, making error-path tests slow and flaky.
 *  - `window.location.assign` is stubbed — jsdom has no navigation, and the
 *    cache dispatch's `redirectLogin` path calls it directly.
 *  - Mantine's notification store is a module-level singleton, so it is
 *    cleaned between tests (see `tests/setup/testing.ts`) rather than reset
 *    by unmounting.
 *
 * `env="test"` disables Mantine transitions and portals, which keeps assertions
 * synchronous and keeps overlay content inside the render container.
 */

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  /** Identity the tree is rendered for; defaults to an Owner fixture. */
  currentUser?: CurrentUser;
}

export function renderWithProviders(
  ui: ReactElement,
  { currentUser = currentUserFixtures.owner(), ...options }: RenderWithProvidersOptions = {}
) {
  // A fresh client per test, with retries off (see docstring above) but the
  // real cache-level error dispatch wired in so a failing mutation/query
  // surfaces as the same toast/redirect it would in production.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
    ...createErrorDispatchCaches(),
  });

  if (typeof window !== "undefined") {
    // jsdom's `Location.prototype.assign` is non-configurable, so it cannot
    // be stubbed directly -- the whole `location` object is replaced instead
    // (its own property on `window` is configurable), fresh on every render,
    // independent of `restoreMocks` timing.
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...window.location, assign: vi.fn() },
    });
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider theme={theme} env="test" defaultColorScheme="light">
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <CurrentUserProvider value={currentUser}>
            {children}
          </CurrentUserProvider>
        </QueryClientProvider>
      </MantineProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export * from "@testing-library/react";
export { renderWithProviders as render };
