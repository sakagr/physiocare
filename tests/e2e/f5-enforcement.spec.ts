import { test, expect } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * F5 E2E — the subscription-enforcement split (UX.md's "Limit / subscription
 * enforcement" row): form dialogs render the dedicated state inline and stay
 * open with input intact; destructive confirms fall back to the flat toast.
 *
 * Runs against its own lapsed organization, whose patient was created while
 * it was still subscribed -- every F5 write is gated, including the create
 * that would otherwise make one. Deliberately not the `unsubscribed` org:
 * the F4 settings spec subscribes that one mid-run.
 */
test.describe("F5 — subscription enforcement (lapsed org)", () => {
  test("a form dialog keeps input and shows the dedicated enforcement state", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.lapsed.owner.username, seed.lapsed.owner.password);
    await page.goto("/app/patients");

    await page.getByRole("button", { name: "New patient" }).first().click();
    await page.getByLabel("Full name").fill("Should Not Be Created");
    await page.getByRole("button", { name: "Create patient" }).click();

    await expect(
      page
        .getByRole("alert")
        .getByText("Your organization doesn't have an active subscription. Select or renew a plan to continue.")
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "New patient" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Should Not Be Created");
  });

  test("a destructive confirm falls back to the flat toast", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.lapsed.owner.username, seed.lapsed.owner.password);
    await page.goto("/app/patients");

    await page.getByRole("button", { name: "Actions for E2E Lapsed Org Patient" }).first().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // A confirm has no input to preserve and no natural slot for an in-dialog
    // alert, so the honest outcome is a closed confirm plus a toast.
    await expect(page.getByText(/subscription/i).first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Delete patient?" })).toHaveCount(0);
  });

  test("reading stays fully available while every write is refused", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.lapsed.owner.username, seed.lapsed.owner.password);

    // "The app is a record of what happened, not the mechanism": an
    // unsubscribed organization can see everything it can no longer change.
    await page.goto(`/app/patients/${seed.lapsed.patientId}`);
    await expect(page.getByRole("heading", { name: "E2E Lapsed Org Patient" })).toBeVisible();
    await page.getByRole("tab", { name: "Records" }).click();
    await expect(page.getByText("No records yet")).toBeVisible();
    await page.getByRole("tab", { name: "Packages" }).click();
    await expect(page.getByText("No packages assigned")).toBeVisible();
  });
});
