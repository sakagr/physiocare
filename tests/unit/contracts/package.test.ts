import { describe, expect, it } from "vitest";
import { packageListResponseSchema, packageSchema } from "@/contracts/package.contract";

/**
 * Response contracts for the Packages catalog domain (F2, M8/R4), mirroring
 * `src/server/repositories/package.repository.ts` → `Package` (the
 * `packages` table row).
 */
const packageFixture = {
  id: "package-1",
  organization_id: "org-1",
  package_name: "10-Session Physio Bundle",
  total_sessions: 10,
  package_price: 500,
  validity_days: 180,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("packageSchema", () => {
  it("parses a package catalog row", () => {
    expect(packageSchema.parse(packageFixture)).toEqual(packageFixture);
  });
});

describe("packageListResponseSchema", () => {
  it("parses the paginated package list (GET /api/packages)", () => {
    const fixture = { items: [packageFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(packageListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
