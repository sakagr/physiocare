import { test, expect } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * F5 E2E — the Packages catalogue (M7) and the workspace assignment tab
 * (M5/M6).
 */
test.describe("F5 — packages", () => {
  test("creates, edits, deactivates, and deletes an unassigned catalogue package", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/packages");

    await expect(page.getByRole("heading", { name: "Packages" })).toBeVisible();

    const name = `${seed.runId} Throwaway Package`;
    await page.getByRole("button", { name: "New package" }).first().click();
    await page.getByLabel("Package name").fill(name);
    await page.getByLabel("Sessions").fill("5");
    await page.getByLabel("Price").fill("2500");
    await page.getByLabel("Validity (days)").fill("60");
    await page.getByRole("button", { name: "Create package" }).click();
    await expect(page.getByText("Package created.")).toBeVisible();

    await page.getByPlaceholder("Search packages").fill(name);
    await expect(page.getByText(name).first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Price").fill("2600");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Package updated.")).toBeVisible();

    // Never assigned, so both deactivate and delete are allowed.
    await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect(page.getByText("Package deactivated.")).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Package deleted.")).toBeVisible();
  });

  test("blocks deactivating a package that has been assigned", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/packages");

    // The seeded package is assigned to the seeded patient, so deactivate is
    // blocked on the same predicate that blocks delete -- and, unusually,
    // there is no safe alternative to fall back to.
    await page.getByPlaceholder("Search packages").fill(seed.main.packageName);
    // Wait for the debounced search to settle before opening the row menu:
    // the list re-renders when it resolves, which would unmount the dropdown.
    await expect(page.getByText(seed.main.packageName).first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: `Actions for ${seed.main.packageName}` }).first().click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Deactivate", exact: true }).click();

    await expect(page.getByText(/assigned to a patient/i).first()).toBeVisible();
  });

  test("browses the catalogue as a physiotherapist with no write affordances", async ({ page }) => {
    const seed = readSeed();
    // The one destination where guarding the page would be actively wrong:
    // every role may browse the catalogue.
    await signIn(page, seed.main.physio.username, seed.main.physio.password);
    await page.goto("/app/packages");

    await expect(page.getByRole("heading", { name: "Packages" })).toBeVisible();
    await expect(page.getByText(seed.main.packageName).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "New package" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Actions for ${seed.main.packageName}` })).toHaveCount(0);
  });

  test("assigns a package from the workspace and opens its empty session list", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto(`/app/patients/${seed.main.patientId}`);
    await page.getByRole("tab", { name: "Packages" }).click();

    // Multiple concurrent assignments are allowed, so assigning the same
    // package again must succeed rather than being blocked.
    await page.getByRole("button", { name: "Assign package" }).first().click();
    await page.getByRole("combobox", { name: "Package" }).click();
    await page.getByRole("option", { name: new RegExp(seed.main.packageName) }).click();
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Package assigned.")).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${seed.main.packageName}` }).first().click();
    await page.getByRole("menuitem", { name: "View sessions" }).click();

    // The empty state is the *normal* state during F5: no F5 surface can
    // consume a session, so it must read as "none yet", not as an error.
    await expect(page.getByText("No sessions used yet")).toBeVisible();
  });
});
