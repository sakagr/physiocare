import { z } from "zod";

/**
 * Environment gating for the platform API explorer (F2, ADR-0009).
 *
 * `NODE_ENV` is read live on every call rather than cached at import time, so
 * it behaves the same way `getSiteUrl()` does under test and so a single
 * process (a test runner switching suites) never sees a stale answer.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

/** Validates and returns the subset of `process.env` this module governs. */
export function getEnv(): Env {
  return envSchema.parse({ NODE_ENV: process.env.NODE_ENV });
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/**
 * Whether the platform API explorer (spec endpoint and UI) may run at all.
 * Hard-disabled in production regardless of role — there is no opt-in flag,
 * so a misconfigured deploy cannot accidentally re-enable it.
 */
export function isApiExplorerEnabled(): boolean {
  return !isProduction();
}
