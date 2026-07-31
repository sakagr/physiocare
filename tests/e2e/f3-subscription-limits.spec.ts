import { test, expect } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * F3 E2E — D8: subscription/limit enforcement uses the generic 402/403
 * toast (UX.md's dedicated enforcement state is F4's). Runs against its own
 * pre-saturated organization (Trial: max_users=5, max_clinics=1, both
 * already at the ceiling from seeding) so it can never race with the main
 * org's tests, which create/remove users and clinics.
 */
test.describe("F3 — subscription/limit enforcement (saturated org)", () => {
  test("create-user stays open with input intact and toasts on ORGANIZATION_LIMIT_EXCEEDED", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.saturated.owner.username, seed.saturated.owner.password);
    await page.goto("/app/users");

    await page.getByRole("button", { name: "New user" }).first().click();
    await page.getByLabel("Full name").fill("Should Not Be Created");
    await page.getByLabel("Username").fill(`${seed.runId}-overflow`);
    await page.getByLabel("Email").fill(`${seed.runId}-overflow@example.test`);
    await page.getByRole("combobox", { name: "Role", exact: true }).click();
    await page.getByRole("option", { name: "Receptionist" }).click();
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByText("You've reached your plan's limit.")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Create user" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Should Not Be Created");
  });

  test("create-clinic stays open with input intact and toasts on ORGANIZATION_LIMIT_EXCEEDED", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.saturated.owner.username, seed.saturated.owner.password);
    await page.goto("/app/clinics");

    await page.getByRole("button", { name: "New clinic" }).first().click();
    await page.getByLabel("Clinic name").fill("Should Not Be Created Clinic");
    await page.getByRole("button", { name: "Create clinic" }).click();

    await expect(page.getByText("You've reached your plan's limit.")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Create clinic" })).toBeVisible();
    await expect(page.getByLabel("Clinic name")).toHaveValue("Should Not Be Created Clinic");
  });
});
