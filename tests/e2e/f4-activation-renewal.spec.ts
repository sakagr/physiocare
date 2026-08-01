import { test, expect } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * F4 E2E — M4: the Activation & Renewal surface is always rendered, real
 * and routed, but permanently disabled (decision 1). Runs against the main
 * org, which already has an active subscription from `global-setup.ts` --
 * read-only, so it cannot race with `f3-users-clinics.spec.ts`'s user/clinic
 * mutations against the same org.
 */
test.describe("F4 — Activation & Renewal (main org)", () => {
  test("renders a disabled Activate/Renew surface that explains itself, nothing clickable", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/settings");

    await page.getByRole("tab", { name: "Subscription" }).click();
    await expect(page.getByRole("heading", { name: "Activation & renewal" })).toBeVisible();
    await expect(page.getByText(/Self-service activation and renewal aren.t available yet/)).toBeVisible();

    const activateButton = page.getByRole("button", { name: "Activate" });
    const renewButton = page.getByRole("button", { name: "Renew" });
    await expect(activateButton).toBeDisabled();
    await expect(renewButton).toBeDisabled();
  });
});
