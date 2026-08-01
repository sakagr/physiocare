import { test, expect } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * F4 E2E — M6: subscription/limit enforcement renders the dedicated
 * role-varying state (UX.md's "Limit / subscription enforcement" row),
 * replacing F3's generic 402/403 toast at these two call sites. Runs
 * against its own pre-saturated organization (Trial: max_users=5,
 * max_clinics=1, both already at the ceiling from seeding) so it can never
 * race with the main org's tests, which create/remove users and clinics.
 */
test.describe("F4 — subscription/limit enforcement (saturated org)", () => {
  test("create-user stays open with input intact and shows the Owner enforcement state on ORGANIZATION_LIMIT_EXCEEDED", async ({ page }) => {
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

    await expect(page.getByRole("alert").getByText("You've reached your plan's limit. Upgrade your plan to add more.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Settings" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Create user" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Should Not Be Created");
  });

  test("create-clinic stays open with input intact and shows the Owner enforcement state on ORGANIZATION_LIMIT_EXCEEDED", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.saturated.owner.username, seed.saturated.owner.password);
    await page.goto("/app/clinics");

    await page.getByRole("button", { name: "New clinic" }).first().click();
    await page.getByLabel("Clinic name").fill("Should Not Be Created Clinic");
    await page.getByRole("button", { name: "Create clinic" }).click();

    await expect(page.getByRole("alert").getByText("You've reached your plan's limit. Upgrade your plan to add more.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Settings" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Create clinic" })).toBeVisible();
    await expect(page.getByLabel("Clinic name")).toHaveValue("Should Not Be Created Clinic");
  });
});
