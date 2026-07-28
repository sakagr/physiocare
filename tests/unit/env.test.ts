import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv, isApiExplorerEnabled, isProduction } from "@/lib/env";

/**
 * `src/lib/env.ts` is new cross-cutting infrastructure (F2, ADR-0009): the
 * platform API explorer's environment gate. `NODE_ENV` is read live, not
 * cached at import time, so it can be overridden per test. `vi.stubEnv` is
 * used rather than direct assignment because `@types/node` marks
 * `process.env.NODE_ENV` read-only.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("environment configuration", () => {
  describe("getEnv", () => {
    it("accepts each recognized environment", () => {
      for (const value of ["development", "test", "production"]) {
        vi.stubEnv("NODE_ENV", value);
        expect(getEnv().NODE_ENV).toBe(value);
      }
    });

    it("defaults to development when NODE_ENV is unset", () => {
      vi.stubEnv("NODE_ENV", undefined);
      expect(getEnv().NODE_ENV).toBe("development");
    });

    it("fails loudly on an unrecognized value rather than silently defaulting", () => {
      vi.stubEnv("NODE_ENV", "staging");
      expect(() => getEnv()).toThrow();
    });
  });

  describe("isProduction", () => {
    it("is true only in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(isProduction()).toBe(true);

      vi.stubEnv("NODE_ENV", "development");
      expect(isProduction()).toBe(false);

      vi.stubEnv("NODE_ENV", "test");
      expect(isProduction()).toBe(false);
    });
  });

  describe("isApiExplorerEnabled", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("is hard-disabled in production regardless of role (decision #6)", () => {
      expect(isApiExplorerEnabled()).toBe(false);
    });

    it("is enabled in every non-production environment, with no opt-in flag", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(isApiExplorerEnabled()).toBe(true);

      vi.stubEnv("NODE_ENV", "test");
      expect(isApiExplorerEnabled()).toBe(true);
    });
  });
});
