"use client";

import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/query-client";
import { cssVariablesResolver, theme } from "@/lib/theme";

/**
 * The client provider tree, mounted once by the root layout.
 *
 * Mantine supplies the design tokens and the notification system used for
 * toasts; TanStack Query owns server state. The QueryClient is held in state
 * so a re-render never discards the cache, while `getQueryClient()` keeps it
 * a browser singleton.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="light"
      cssVariablesResolver={cssVariablesResolver}
    >
      <Notifications position="bottom-right" />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MantineProvider>
  );
}
