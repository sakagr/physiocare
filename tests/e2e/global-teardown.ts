import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import WebSocket from "ws";
import type { SeedData } from "./global-setup";

loadEnv({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });

const SEED_FILE = path.resolve(__dirname, ".seed.json");

/** Mirrors `tests/helpers/integration-context.ts`'s afterAll cleanup. */
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(SEED_FILE)) {
    return;
  }

  const seed = JSON.parse(readFileSync(SEED_FILE, "utf8")) as SeedData;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });

  for (const organizationId of seed.createdOrganizationIds) {
    await db.from("organizations").delete().eq("id", organizationId);
  }
  for (const userId of seed.createdAuthUserIds) {
    await db.auth.admin.deleteUser(userId);
  }

  rmSync(SEED_FILE, { force: true });
}
