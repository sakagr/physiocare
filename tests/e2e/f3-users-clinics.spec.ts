import { test, expect } from "@playwright/test";
import { readSeed, signIn, signOut } from "./helpers";

/**
 * F3 E2E — the main-org scenarios. Scoped to what only a real browser can
 * prove: actual session cookies and sign-in, real navigation, CSS media
 * queries, the clipboard. Everything else (form validation, capability
 * gating logic, mutation wiring) is already proven by the jsdom component
 * lane against fixtures -- this lane does not re-cover it.
 */
test.describe.configure({ mode: "serial" });

test.describe("F3 — Users & Clinics (main org)", () => {
  test("creates a user, reveals the initial password exactly once, and the new user can sign in with it", async ({ page, context }) => {
    const seed = readSeed();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/users");

    await page.getByRole("button", { name: "New user" }).first().click();
    await page.getByLabel("Full name").fill("E2E Created Receptionist");
    await page.getByLabel("Username").fill(`${seed.runId}-created-reception`);
    await page.getByLabel("Email").fill(`${seed.runId}-created-reception@example.test`);
    await page.getByRole("combobox", { name: "Role", exact: true }).click();
    await page.getByRole("option", { name: "Receptionist" }).click();
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByText("User created")).toBeVisible();
    const passwordInput = page.getByLabel("Initial password");
    await expect(passwordInput).toHaveAttribute("type", "password");
    const revealedPassword = await passwordInput.inputValue();
    expect(revealedPassword).toHaveLength(16);

    await page.getByRole("button", { name: /toggle password visibility/i }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(revealedPassword);

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(/won't be able to see this password again/)).toBeVisible();
    await page.getByRole("button", { name: "I've saved it" }).click();
    await expect(page.getByText(/was created\./)).toBeVisible();

    await signOut(page);
    await signIn(page, `${seed.runId}-created-reception`, revealedPassword);
    await expect(page).toHaveURL(/\/app/);
  });

  test("an Administrator sees no manage actions or compensation on the Owner's row, but does on a row they can manage", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.admin.username, seed.main.admin.password);
    await page.goto("/app/users");

    await page.getByText("E2E Owner").first().click();
    await expect(page.getByRole("heading", { name: "E2E Owner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change role" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset password" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Off-board" })).toHaveCount(0);
    await expect(page.getByText("Compensation", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByText("E2E Physio").first().click();
    await expect(page.getByRole("heading", { name: "E2E Physio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Off-board" })).toBeVisible();
    await expect(page.getByText("Compensation", { exact: true })).toHaveCount(0);
  });

  test("reflows the users collection between a table and stacked cards by viewport", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/users");
    await expect(page.getByText("E2E Owner").first()).toBeVisible();

    // `display:none` elements are pruned from the accessibility tree
    // entirely (not merely marked not-visible), so `getByRole` only ever
    // resolves the one currently-shown "New user" button at a given
    // viewport -- confirmed by inspecting both candidates directly rather
    // than assuming a `.first()`/`.last()` pairing. Its position
    // distinguishes which one it is: the header's inline button sits near
    // the top, the Affix FAB is fixed at bottom-right (PageHeader, `UX.md`
    // → Responsive behavior).
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole("table")).toBeVisible();
    const wideButton = page.getByRole("button", { name: "New user" });
    await expect(wideButton).toHaveCount(1);
    const wideBox = await wideButton.boundingBox();
    expect(wideBox?.y).toBeLessThan(200);

    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.getByRole("table")).toBeHidden();
    await expect(page.locator(".mantine-Card-root").first()).toBeVisible();
    const narrowButton = page.getByRole("button", { name: "New user" });
    await expect(narrowButton).toHaveCount(1);
    const narrowBox = await narrowButton.boundingBox();
    expect(narrowBox?.y).toBeGreaterThan(600);
  });

  test("assigns a user to a clinic from the user drawer, sees it from the clinic drawer, and removal is reflected on both sides", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);

    await page.goto("/app/users");
    await page.getByText("E2E Physio").first().click();
    await expect(page.getByText("Not assigned to any clinic yet.")).toBeVisible();
    await page.getByPlaceholder("Assign to a clinic").click();
    await page.getByRole("option", { name: seed.main.clinicName }).click();
    await page.getByRole("button", { name: "Assign" }).click();
    // Exact match: the top bar's working-context text ("org (clinic)")
    // also contains the clinic name as a substring.
    await expect(page.getByText(seed.main.clinicName, { exact: true })).toBeVisible();
    await expect(page.getByText("Clinic assigned.")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.goto("/app/clinics");
    // The table↔card responsive pair (ADR-0002) both exist in the DOM;
    // the default (desktop-sized) viewport shows the table, so target its
    // cell specifically rather than the hidden card's matching text.
    await page.getByRole("cell", { name: seed.main.clinicName, exact: true }).click();
    await expect(page.getByText("E2E Physio · Physiotherapist")).toBeVisible();

    await page.getByRole("button", { name: "Remove E2E Physio" }).click();
    await expect(page.getByText(/lose access to this clinic/)).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("Assignment removed.")).toBeVisible();
    await expect(page.getByText("No staff assigned yet.")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.goto("/app/users");
    await page.getByText("E2E Physio").first().click();
    await expect(page.getByText("Not assigned to any clinic yet.")).toBeVisible();
  });

  test("sets a user's compensation twice and the history shows the newest record first", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/users");
    await page.getByText("E2E Physio").first().click();
    await expect(page.getByText("Compensation", { exact: true })).toBeVisible();
    await expect(page.getByText("No compensation has been set yet.")).toBeVisible();

    await page.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Fixed" }).click();
    await page.getByLabel("Value").fill("400");
    await page.getByLabel("Effective from").fill("2020-01-01");
    await page.getByRole("button", { name: "Save compensation" }).click();
    await expect(page.getByText("Compensation updated.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "2020-01-01" })).toBeVisible();

    await page.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Fixed" }).click();
    await page.getByLabel("Value").fill("500");
    await page.getByLabel("Effective from").fill("2026-06-01");
    await page.getByRole("button", { name: "Save compensation" }).click();
    await expect(page.getByText("Compensation updated.")).toBeVisible();

    // Scoped to the drawer: the Users collection's own table sits behind it
    // in the DOM and would otherwise also match a bare `table tbody tr`.
    const firstDataRow = page.getByRole("dialog").locator("table tbody tr").first();
    await expect(firstDataRow).toContainText("2026-06-01");
  });
});
