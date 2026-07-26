import type { ReactElement, ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { theme } from "@/lib/theme";
import { CurrentUserProvider } from "@/lib/auth/current-user-context";
import type { CurrentUser } from "@/types/contracts/me";
import { currentUserFixtures } from "./current-user";

/**
 * The entry point for every component test in the app. It mounts the same
 * provider tree the real application does — theme, server state, current user
 * — so a test exercises components under the conditions they actually run in.
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
  // A fresh client per test, with retries off so a failing query surfaces
  // immediately instead of after the production retry schedule.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider theme={theme} env="test" defaultColorScheme="light">
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
