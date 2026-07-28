import { describe, expect, it } from "vitest";
import { auditLogListResponseSchema, auditLogSchema } from "@/contracts/audit-log.contract";

/**
 * Response contract for the Audit Logs domain (F2, M8/R8), mirroring
 * `src/server/repositories/audit-log.repository.ts` → `AuditLog` (the
 * `audit_logs` table row). `old_data`/`new_data` are the database's `Json`
 * column type -- an arbitrary JSON value, not a fixed shape.
 */
const auditLogFixture = {
  id: "audit-1",
  organization_id: "org-1",
  user_id: "user-1",
  action: "update",
  entity_name: "packages",
  entity_id: "package-1",
  old_data: { is_active: true },
  new_data: { is_active: false },
  created_at: "2026-01-01T00:00:00Z",
};

describe("auditLogSchema", () => {
  it("parses an audit log row", () => {
    expect(auditLogSchema.parse(auditLogFixture)).toEqual(auditLogFixture);
  });

  it("allows a system-actor entry (no user, no prior data)", () => {
    const fixture = { ...auditLogFixture, user_id: null, old_data: null };
    expect(() => auditLogSchema.parse(fixture)).not.toThrow();
  });
});

describe("auditLogListResponseSchema", () => {
  it("parses the paginated audit log list (GET /api/audit-logs)", () => {
    const fixture = { items: [auditLogFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(auditLogListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
