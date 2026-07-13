import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createNotification, getNotificationDetails, listOrganizationNotifications } from "@/server/services/notification.service";
import { validNotificationInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Notification lifecycle", () => {
  const ctx = setupIntegrationContext("notifications");

  it("persists a pending notification for a user recipient and scopes visibility by role", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "physio");

    const notification = await createNotification(ctx.admin, owner.id, validNotificationInput({ userId: physio.id }));
    expect(notification).toMatchObject({ status: "pending", sent_at: null, user_id: physio.id });

    const ownerView = await listOrganizationNotifications(ctx.admin, owner.id, { page: 1, limit: 10 });
    expect(ownerView.items.map((n) => n.id)).toContain(notification.id);

    const physioView = await listOrganizationNotifications(ctx.admin, physio.id, { page: 1, limit: 10 });
    expect(physioView.items.map((n) => n.id)).toEqual([notification.id]);

    const details = await getNotificationDetails(ctx.admin, physio.id, notification.id);
    expect(details.id).toBe(notification.id);
  });

  it("prevents a non-manager from viewing someone else's notification", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-fb-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "fb-owner");
    const physioOne = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "fb-physio-1");
    const physioTwo = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "fb-physio-2");

    const notification = await createNotification(ctx.admin, owner.id, validNotificationInput({ userId: physioOne.id }));

    await expect(getNotificationDetails(ctx.admin, physioTwo.id, notification.id)).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});
