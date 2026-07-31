import { defineConfig } from "@playwright/test";

/**
 * The E2E lane (F3): its own runner, its own lifecycle, deliberately not
 * folded into the Vitest integration lane (AGENTS.md → Frontend Testing /
 * TDD). Scoped to what only a real browser can prove — actual session
 * cookies and sign-in, real navigation, CSS media queries, the clipboard —
 * not a re-cover of what the jsdom component lane already asserts.
 *
 * Requires the local Supabase stack running (`supabase start`) and the
 * env vars in `.env.local`; `globalSetup` seeds fixture data directly
 * against it, the same way `tests/helpers/integration-context.ts` does for
 * the Vitest integration lane.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  // Turbopack dev-mode compiles each route on its first visit; a toast that
  // auto-dismisses can appear and vanish before the default 5s assertion
  // window on a cold route. Widened here rather than masked per-assertion.
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
