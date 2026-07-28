import { describe, expect, it } from "vitest";
import { userClinicSchema } from "@/contracts/user-clinic.contract";

/**
 * Response contract for user-clinic assignments (F2, M8/R2), mirroring
 * `src/server/repositories/user-clinic.repository.ts` → `UserClinic` (the
 * `user_clinics` table row). Shared by POST and DELETE /api/user-clinics --
 * both return the assignment row itself (create, or the just-removed row).
 */
describe("userClinicSchema", () => {
  it("parses an assignment row", () => {
    const fixture = {
      id: "assignment-1",
      organization_id: "org-1",
      user_id: "user-1",
      clinic_id: "clinic-1",
      assigned_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    };
    expect(userClinicSchema.parse(fixture)).toEqual(fixture);
  });
});
