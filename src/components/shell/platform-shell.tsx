"use client";

import { AppShell } from "@mantine/core";
import { TopBar } from "./top-bar";

/**
 * The platform shell: a top bar with the user menu, and nothing else. The V1
 * platform surface is deliberately minimal — Super Admin gets in-app API
 * tooling, not an operational console — so there is no primary navigation to
 * render (UX.md → App-shell regions, Primary navigation — platform console).
 */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell padding="lg" header={{ height: 56 }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <AppShell.Header>
        <TopBar />
      </AppShell.Header>

      <AppShell.Main id="main-content" bg="var(--mantine-color-page)">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
