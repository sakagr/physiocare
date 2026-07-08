import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type User = Database["public"]["Tables"]["users"]["Row"];
export type InsertUser = Database["public"]["Tables"]["users"]["Insert"];
export type UpdateUser = Database["public"]["Tables"]["users"]["Update"];
export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Finds a profile by email in the public users table.
 * 
 * @param supabase - The Supabase client.
 * @param email - The email to check.
 * @returns The user record if found, or null.
 */
export async function findUserByEmail(
  supabase: SupabaseClient<Database>,
  email: string
): Promise<User | null> {
  throw new Error("Not implemented");
}

/**
 * Finds a role record by its role name enum value.
 * 
 * @param supabase - The Supabase client.
 * @param name - The role name enum value.
 * @returns The role record if found, or null.
 */
export async function findRoleByName(
  supabase: SupabaseClient<Database>,
  name: AppRole
): Promise<Role | null> {
  throw new Error("Not implemented");
}

/**
 * Inserts a public user profile in the database.
 * 
 * @param supabase - The Supabase client.
 * @param user - The user insert payload.
 * @returns The created user profile.
 */
export async function insertUser(
  supabase: SupabaseClient<Database>,
  user: InsertUser
): Promise<User> {
  throw new Error("Not implemented");
}


