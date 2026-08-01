import { test, expect } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * F4 E2E — Settings destination. Two scenarios share the unsubscribed org
 * fixture (no plan selected yet) and run serially against it: editing the
 * organization profile does not depend on subscription state, and plan
 * selection needs an org no other spec has already select+activate'd.
 */
test.describe.configure({ mode: "serial" });

test.describe("F4 — Settings (unsubscribed org)", () => {
  test("Owner edits and saves the organization profile (M1)", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.unsubscribed.owner.username, seed.unsubscribed.owner.password);
    await page.goto("/app/settings");

    await expect(page.getByRole("tab", { name: "Organization" })).toBeVisible();
    const nameInput = page.getByLabel("Organization name");
    await nameInput.fill(`${seed.runId}-unsubscribed Renamed`);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Organization profile updated.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Organization name")).toHaveValue(`${seed.runId}-unsubscribed Renamed`);
  });

  test("Owner selects the Trial plan from the catalog (M3)", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.unsubscribed.owner.username, seed.unsubscribed.owner.password);
    await page.goto("/app/settings");

    await page.getByRole("tab", { name: "Subscription" }).click();
    await expect(page.getByText("Choose a plan to get started.")).toBeVisible();
    await page.getByRole("button", { name: "Select Trial" }).click();

    await expect(page.getByText("Trial started.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible();
    await expect(page.getByText("Choose a plan to get started.")).toBeHidden();
  });
});
