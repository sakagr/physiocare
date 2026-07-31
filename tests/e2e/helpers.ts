import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { SeedData } from "./global-setup";

const SEED_FILE = path.resolve(__dirname, ".seed.json");

/** Read lazily (inside a test/`beforeAll`), never at module top level -- the file only exists once `globalSetup` has run. */
export function readSeed(): SeedData {
  return JSON.parse(readFileSync(SEED_FILE, "utf8")) as SeedData;
}

export async function signIn(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle" });
  // The dev server (Turbopack, unminified) hydrates visibly after the
  // server-rendered HTML is already interactive-looking; clicking "Sign in"
  // before React attaches its submit handler falls through to a native GET
  // submission (observed once as a real failure: the browser navigated to
  // `/login?username=...&password=...` instead of calling `/api/auth/login`
  // at all). `networkidle` alone did not fully close that window, so this
  // waits for the form to actually be submittable via its React handler.
  await page.getByRole("button", { name: "Sign in" }).waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app/, { timeout: 15_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}
