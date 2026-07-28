import { describe, expect, it } from "vitest";
import {
  ORG_CAPABILITIES,
  PLATFORM_CAPABILITIES,
} from "@/server/services/me.service";
import { CAPABILITIES } from "@/types/contracts/me";

/**
 * `computeCapabilities` is scoped by group vocabulary rather than evaluating
 * every predicate for every user (F2, ADR-0009) -- platform users previously
 * got an unconditionally empty capability array, which made a platform-only
 * capability like `platformApi:explore` inexpressible without this
 * restructure. The two vocabularies must exactly partition the contract's
 * full token union: every token placed in exactly one group, none left out
 * (which would make it ungrantable) and none duplicated (which would blur
 * which predicate set decides it).
 */
describe("capability vocabularies", () => {
  it("partition the full CAPABILITIES union with no gap", () => {
    const covered = new Set([...ORG_CAPABILITIES, ...PLATFORM_CAPABILITIES]);
    for (const token of CAPABILITIES) {
      expect(covered.has(token)).toBe(true);
    }
  });

  it("partition the full CAPABILITIES union with no overlap", () => {
    const orgSet = new Set(ORG_CAPABILITIES);
    for (const token of PLATFORM_CAPABILITIES) {
      expect(orgSet.has(token)).toBe(false);
    }
  });

  it("contain no token outside the contract vocabulary", () => {
    const known = new Set(CAPABILITIES);
    for (const token of [...ORG_CAPABILITIES, ...PLATFORM_CAPABILITIES]) {
      expect(known.has(token)).toBe(true);
    }
  });
});
