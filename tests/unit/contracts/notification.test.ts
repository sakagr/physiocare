import { describe, expect, it } from "vitest";
import { notificationListResponseSchema, notificationSchema } from "@/contracts/notification.contract";

/**
 * Response contracts for the Notifications domain (F2, M8/R8), mirroring
 * `src/server/repositories/notification.repository.ts` → `Notification`
 * (the `notifications` table row). Persistence only in this phase --
 * `sent_at` stays null; there is no dispatch integration yet.
 */
const notificationFixture = {
  id: "notification-1",
  organization_id: "org-1",
  recipient_type: "patient",
  user_id: null,
  patient_id: "patient-1",
  appointment_id: "appointment-1",
  notification_type: "appointment_reminder",
  channel: "sms",
  message: "Your appointment is tomorrow at 10am.",
  status: "pending",
  sent_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("notificationSchema", () => {
  it("parses a notification row", () => {
    expect(notificationSchema.parse(notificationFixture)).toEqual(notificationFixture);
  });
});

describe("notificationListResponseSchema", () => {
  it("parses the paginated notification list (GET /api/notifications)", () => {
    const fixture = { items: [notificationFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(notificationListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
