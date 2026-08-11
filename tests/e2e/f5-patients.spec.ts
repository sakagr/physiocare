import { test, expect } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * F5 E2E — the Patients destination and the Patient Workspace (M1–M4).
 */
test.describe("F5 — patients", () => {
  test("browses, searches, creates, edits, and deletes a patient", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/patients");

    await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();
    await expect(page.getByText(seed.main.patientCode).first()).toBeVisible();

    const fullName = `${seed.runId} Created Patient`;
    await page.getByRole("button", { name: "New patient" }).first().click();
    await page.getByLabel("Full name").fill(fullName);
    await page.getByLabel("Phone").fill("9111111111");
    await page.getByRole("button", { name: "Create patient" }).click();
    await expect(page.getByText("Patient created.")).toBeVisible();

    await page.getByPlaceholder("Search by name, code, or phone").fill(fullName);
    await expect(page.getByText(fullName).first()).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${fullName}` }).first().click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Full name").fill(`${fullName} Edited`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Patient updated.")).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${fullName} Edited` }).first().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Patient deleted.")).toBeVisible();
  });

  test("warns about a possible duplicate without blocking the create", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto("/app/patients");

    await page.getByRole("button", { name: "New patient" }).first().click();
    // The same name as the seeded patient: the warning is advisory, so the
    // submit stays enabled and the second patient is genuinely created.
    await page.getByLabel("Full name").fill("E2E Seeded Patient");
    await page.getByLabel("Phone").click();

    await expect(page.getByText("Possible duplicate")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create patient" })).toBeEnabled();
  });

  test("opens the workspace and moves between its three tabs", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto(`/app/patients/${seed.main.patientId}`);

    await expect(page.getByRole("heading", { name: "E2E Seeded Patient" })).toBeVisible();
    await expect(page.getByText(seed.main.patientCode).first()).toBeVisible();

    // Exactly the three sections F5 owns -- appointments and invoices are not
    // stubbed, so their tabs must be absent rather than present-and-empty.
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Records" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Packages" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Appointments" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Invoices" })).toHaveCount(0);

    await page.getByRole("tab", { name: "Packages" }).click();
    await expect(page.getByText(seed.main.packageName).first()).toBeVisible();
  });

  test("uploads a record as Owner and then deletes it", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.main.owner.username, seed.main.owner.password);
    await page.goto(`/app/patients/${seed.main.patientId}`);
    await page.getByRole("tab", { name: "Records" }).click();

    const title = `${seed.runId} Owner Upload`;
    await page.getByRole("button", { name: "Upload record" }).first().click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 e2e owner"),
    });
    await page.getByRole("combobox", { name: "Record type" }).click();
    await page.getByRole("option", { name: "X-ray" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText("Record uploaded.")).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();

    await page.getByRole("button", { name: `Delete ${title}` }).first().click();
    // The strongest confirmation tier: the file goes with the row, so the
    // copy must say irreversible and offer no Undo.
    await expect(page.getByText("This cannot be undone.")).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Record deleted.")).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("lets a receptionist with no clinic assignment upload and read records", async ({ page }) => {
    const seed = readSeed();
    // The Q3 proof end to end: this receptionist is assigned to no clinic and
    // the seeded patient has no appointment, which the old predicate and the
    // old RLS policy both refused.
    await signIn(page, seed.main.receptionist.username, seed.main.receptionist.password);
    await page.goto(`/app/patients/${seed.main.patientId}`);
    await page.getByRole("tab", { name: "Records" }).click();

    const title = `${seed.runId} Reception Upload`;
    await page.getByRole("button", { name: "Upload record" }).first().click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "intake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 e2e reception"),
    });
    await page.getByRole("combobox", { name: "Record type" }).click();
    await page.getByRole("option", { name: "Lab report" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Upload", exact: true }).click();

    await expect(page.getByText("Record uploaded.")).toBeVisible();
    // Reading it back is the half that actually breaks without the RLS change.
    await expect(page.getByText(title).first()).toBeVisible();

    // Reception may upload but not delete -- the deliberate asymmetry.
    await expect(page.getByRole("button", { name: `Delete ${title}` })).toHaveCount(0);
  });
});
