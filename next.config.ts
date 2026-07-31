import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright's E2E lane (F3) drives the dev server via 127.0.0.1, which
  // Next's dev-origin check otherwise treats as cross-origin from
  // localhost, blocking the client JS bundle (and so hydration entirely --
  // a click on any form falls through to a native, unhandled submission).
  // Dev-only; has no effect on `next build`/production.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
