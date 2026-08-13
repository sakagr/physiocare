import { expect, test } from "@playwright/test";
import { readSeed, signIn } from "./helpers";

test.describe("F6 — consultation", () => {
  test("records a consultation and a prescription from the nested destination", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.physio.username, seed.f6.physio.password);

    await page.goto(`/app/appointments/${seed.f6.consultationAppointmentId}/consultation`);

    // "Not started yet" is the normal state, and it renders the create form
    // rather than a not-found frame -- the whole reason the read endpoint
    // returns a null body with a 200 instead of a 404.
    await expect(page.getByRole("button", { name: "Record consultation" })).toBeVisible();

    // A nested destination carries its parent and a return path. Scoped to
    // the page: the nav item points at the same href.
    await expect(
      page.locator("#main-content").getByRole("link", { name: "Appointments" })
    ).toBeVisible();

    await page.getByLabel("Symptoms").fill("Lower back pain after lifting");
    await page.getByLabel("Diagnosis notes").fill("Lumbar muscular strain");
    await page.getByRole("button", { name: "Record consultation" }).click();
    await expect(page.getByText("Consultation recorded.")).toBeVisible();

    // The prescription section appears only once there is a consultation to
    // hang it off.
    await expect(page.getByText("Prescriptions")).toBeVisible();
    await page.getByRole("button", { name: "Add prescription" }).first().click();
    await page.getByLabel("Advice").fill("Ice twice daily; avoid lifting for a week");
    await page.getByRole("button", { name: "Add prescription" }).last().click();
    await expect(page.getByText("Prescription added.")).toBeVisible();

    // Reloading proves both writes persisted, and that a recorded visit now
    // resolves to the edit form rather than the create form.
    await page.reload();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(page.getByLabel("Symptoms")).toHaveValue("Lower back pain after lifting");
    await expect(page.getByText("Ice twice daily; avoid lifting for a week")).toBeVisible();
  });

  test("shows a receptionist the record read-only", async ({ page }) => {
    const seed = readSeed();
    await signIn(page, seed.f6.receptionist.username, seed.f6.receptionist.password);

    await page.goto(`/app/appointments/${seed.f6.consultationAppointmentId}/consultation`);

    // Read-only rather than a forbidden frame: a receptionist at the
    // appointment's clinic legitimately may see the visit.
    await expect(page.getByText(/view this visit's clinical record but not change it/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add prescription" })).toHaveCount(0);
  });
});
