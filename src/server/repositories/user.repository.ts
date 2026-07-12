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
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
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
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("name", name)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
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
  const { data, error } = await supabase
    .from("users")
    .insert(user)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a user profile by their ID.
 * 
 * @param supabase - The Supabase client.
 * @param id - The ID of the user to find.
 * @returns The user record if found, or null.
 */
export async function findUserById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a role record by its ID.
 * 
 * @param supabase - The Supabase client.
 * @param id - The ID of the role to find.
 * @returns The role record if found, or null.
 */
export async function findRoleById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<Role | null> {
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a profile by username in the public users table.
 * 
 * @param supabase - The Supabase client.
 * @param username - The username to check.
 * @returns The user record if found, or null.
 */
export async function findUserByUsername(
  supabase: SupabaseClient<Database>,
  username: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}



