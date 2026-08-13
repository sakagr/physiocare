import { expect, test } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

/**
 * Scoped to what only a real browser proves -- real sessions, real
 * navigation, the destinations actually being reachable -- never re-covering
 * what the jsdom component lane already asserts about capability filtering
 * and DOM state (`AGENTS.md` → *Frontend Testing*).
 */
test.describe("F6 — appointments", () => {
  test("lets reception schedule an appointment, choosing clinic before physiotherapist", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.receptionist.username, seed.f6.receptionist.password);

    // The destination is reachable at all for a receptionist -- before F6 the
    // nav item was gated on `appointments:oversee` and this route was closed
    // to them entirely.
    await page.goto("/app/appointments");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();

    await page.getByRole("button", { name: "Schedule appointment" }).first().click();
    // Scoped to the dialog: the board's own filters carry the same labels.
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("combobox", { name: "Patient" }).click();
    await page.getByRole("option", { name: new RegExp(seed.f6.patientName) }).first().click();

    // Clinic first: the physiotherapist picker is disabled until one is
    // chosen, because the server's booking rule is "physiotherapist assigned
    // to this clinic".
    await expect(dialog.getByPlaceholder("Choose a clinic first")).toBeDisabled();
    await dialog.getByRole("combobox", { name: "Clinic", exact: true }).click();
    await page.getByRole("option", { name: seed.f6.clinicName }).click();

    await dialog.getByRole("combobox", { name: "Physiotherapist" }).click();
    await page.getByRole("option", { name: "E2E F6 Physio" }).click();

    const when = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await dialog.getByLabel("Date and time").fill(when);

    await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByText("Appointment scheduled.")).toBeVisible();
    await expect(page.getByText(seed.f6.patientName).first()).toBeVisible();
  });

  test("progresses an appointment through the status workflow from the row", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.owner.username, seed.f6.owner.password);
    await page.goto("/app/appointments");

    const row = page.getByRole("row").filter({ hasText: seed.f6.patientName }).first();
    await expect(row).toBeVisible();

    // The controls come from the server's `allowedTransitions`, so what is
    // offered here is exactly what the server would accept.
    await row.getByRole("button", { name: "Confirm" }).first().click();
    await expect(page.getByText("Appointment confirmd.")).toBeVisible();

    await expect(
      page.getByRole("row").filter({ hasText: seed.f6.patientName }).first().getByRole("button", { name: "Check in" })
    ).toBeVisible();
  });

  test("gives a physiotherapist their own schedule without the org-wide framing", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.physio.username, seed.f6.physio.password);

    await page.goto("/app/appointments");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await expect(page.getByText(seed.f6.patientName).first()).toBeVisible();

    // Their list is by definition all their own, so the staff filter is noise.
    await expect(page.getByRole("combobox", { name: "Physiotherapist" })).toHaveCount(0);
  });

  test("shows the appointments tab on the patient workspace", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.owner.username, seed.f6.owner.password);
    await page.goto(`/app/patients/${seed.f6.patientId}`);

    await page.getByRole("tab", { name: "Appointments" }).click();
    await expect(page.getByText(seed.f6.clinicName).first()).toBeVisible();
  });
});
