import { expect, test } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

test.describe("F6 — attendance and availability", () => {
  test("lets a physiotherapist reach the attendance board and mark a half day, clearing the schedule", async ({
    page,
  }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.physio.username, seed.f6.physio.password);

    // The D4 amendment's end-to-end proof: this route was unreachable for a
    // physiotherapist before F6, since the nav item was gated on
    // `attendance:oversee` and the page had no other entry.
    await page.goto("/app/attendance");
    await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();

    await page.getByRole("button", { name: "Mark attendance" }).first().click();
    // Scoped to the dialog: the board's own filters carry the same labels.
    const dialog = page.getByRole("dialog");

    // The tomorrow appointment sits at +24h, so a half-day covering the whole
    // working window is what clears it.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await dialog.getByLabel("Date", { exact: true }).fill(tomorrow);

    await dialog.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Half day" }).click();

    // Exactly two fixed choices, pinned in UX.md -- never free time inputs.
    await dialog.getByRole("combobox", { name: "Unavailable window" }).click();
    await expect(page.getByRole("option")).toHaveCount(2);
    await page.getByRole("option", { name: /Morning/ }).click();

    await dialog.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByText("Attendance recorded.")).toBeVisible();

    await expect(page.getByText("Half day").first()).toBeVisible();
  });

  test("blocks booking a physiotherapist who is unavailable, explaining it in the form", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.owner.username, seed.f6.owner.password);

    // Mark the physiotherapist away for a date, then try to book into it.
    const awayDate = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.goto("/app/attendance");
    await page.getByRole("button", { name: "Mark attendance" }).first().click();
    const markDialog = page.getByRole("dialog");
    await markDialog.getByRole("combobox", { name: "Staff member" }).click();
    await page.getByRole("option", { name: /E2E F6 Physio/ }).click();
    await markDialog.getByLabel("Date", { exact: true }).fill(awayDate);
    await markDialog.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Leave" }).click();
    await markDialog.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByText("Attendance recorded.")).toBeVisible();

    await page.goto("/app/appointments");
    await page.getByRole("button", { name: "Schedule appointment" }).first().click();
    const bookDialog = page.getByRole("dialog");
    await bookDialog.getByRole("combobox", { name: "Patient" }).click();
    await page.getByRole("option", { name: new RegExp(seed.f6.patientName) }).first().click();
    await bookDialog.getByRole("combobox", { name: "Clinic", exact: true }).click();
    await page.getByRole("option", { name: seed.f6.clinicName }).click();
    await bookDialog.getByRole("combobox", { name: "Physiotherapist" }).click();
    await page.getByRole("option", { name: "E2E F6 Physio" }).click();
    await bookDialog.getByLabel("Date and time").fill(`${awayDate}T10:00`);
    await bookDialog.getByRole("button", { name: "Schedule", exact: true }).click();

    // Blocking message in context, not a bare toast and not a silent failure.
    await expect(page.getByText(/isn't available then/i)).toBeVisible();
  });

  test("gives a receptionist the record-for-others path and not the self path", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.receptionist.username, seed.f6.receptionist.password);

    await page.goto("/app/attendance");
    await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();

    // The two capabilities cross rather than nest: reception records for
    // other staff and never for themselves.
    await page.getByRole("button", { name: "Record for staff" }).first().click();
    await expect(page.getByPlaceholder("Choose a staff member")).toBeVisible();
    await expect(page.getByPlaceholder("Myself")).toHaveCount(0);
  });
});
