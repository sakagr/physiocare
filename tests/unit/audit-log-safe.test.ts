import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const mocks = vi.hoisted(() => ({
  insertAuditLogWithoutReturn: vi.fn(),
  insertAuditLog: vi.fn(),
}));

vi.mock("@/server/repositories/audit-log.repository", () => ({
  insertAuditLog: mocks.insertAuditLog,
  insertAuditLogWithoutReturn: mocks.insertAuditLogWithoutReturn,
  listAuditLogs: vi.fn(),
  countAuditLogs: vi.fn(),
}));

const { recordAuditLogSafe } = await import("@/server/services/audit-log.service");

const supabase = {} as SupabaseClient<Database>;

const entry = {
  organizationId: "org-1",
  userId: "user-1",
  action: "delete",
  entityName: "patient_records",
  entityId: "record-1",
  oldData: { id: "record-1", title: "Knee X-Ray", notes: "Suspected meniscus tear" },
};

describe("recordAuditLogSafe", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("resolves when the audit insert fails, so a failed audit never fails the operation", async () => {
    // The mutation has already committed and no transaction spans both
    // writes, so a rejection here must not surface as a failed command.
    mocks.insertAuditLogWithoutReturn.mockRejectedValueOnce(new Error("audit table unavailable"));

    await expect(recordAuditLogSafe(supabase, entry)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns with identifiers and the error only, never the row snapshot", async () => {
    mocks.insertAuditLogWithoutReturn.mockRejectedValueOnce(new Error("audit table unavailable"));

    await recordAuditLogSafe(supabase, entry);

    // Logs are not access-controlled; audit_logs is. The payload is a full
    // row snapshot and, for patients and patient records, carries personal
    // and clinical data -- so the field list is the "secure" part, and this
    // is the assertion that catches someone "helpfully" adding `entry`.
    const [, logged] = warn.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(logged).sort()).toEqual([
      "action",
      "entityId",
      "entityName",
      "error",
      "organizationId",
      "userId",
    ]);
    expect(JSON.stringify(logged)).not.toContain("meniscus");
  });

  it("renders a Supabase error object rather than [object Object]", async () => {
    // Supabase rejects with a plain PostgrestError, not an Error instance.
    mocks.insertAuditLogWithoutReturn.mockRejectedValueOnce({ code: "42501", message: "permission denied" });

    await recordAuditLogSafe(supabase, entry);

    const [, logged] = warn.mock.calls[0] as [string, Record<string, unknown>];
    expect(logged.error).toBe("permission denied");
  });

  it("does not read the row back, so a non-Owner caller's own insert is not misreported", async () => {
    // audit_logs_insert_policy admits any org member; audit_logs_select_policy
    // admits only ORG_OWNER/ORG_ADMIN. Reading the row back through a
    // receptionist's session client returns no rows for a write that
    // succeeded, which would warn on every Reception-performed mutation.
    await recordAuditLogSafe(supabase, entry);

    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
    expect(mocks.insertAuditLogWithoutReturn).toHaveBeenCalledWith(supabase, {
      organization_id: "org-1",
      user_id: "user-1",
      action: "delete",
      entity_name: "patient_records",
      entity_id: "record-1",
      old_data: entry.oldData,
      new_data: null,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
