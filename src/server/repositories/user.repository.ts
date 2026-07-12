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

/**
 * Updates a user profile in the database.
 * 
 * @param supabase - The Supabase client.
 * @param userId - The ID of the user to update.
 * @param payload - The update payload.
 * @returns The updated user record.
 */
export async function updateUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  payload: UpdateUser
): Promise<User> {
  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a user profile by their ID, returning it with the associated role details.
 * 
 * @param supabase - The Supabase client.
 * @param userId - The ID of the user.
 * @returns The user record with role relation, or null.
 */
export async function findUserWithRoleById(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<(User & { role: Role }) | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*, role:roles(*)")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as any;
}

/**
 * Fetches a paginated, filtered list of non-deleted users in the organization.
 * Performs search matching against full_name, username, email, and phone.
 */
export async function listUsers(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    role?: AppRole;
    isActive?: boolean;
  }
): Promise<(User & { role: Role })[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("users")
    .select("*, role:roles!inner(*)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters.role) {
    query = query.eq("roles.name", filters.role);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(
      `full_name.ilike.${searchPattern},username.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return data as any;
}

/**
 * Counts non-deleted users matching search/filter criteria within an organization.
 */
export async function countUsers(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    search?: string;
    role?: AppRole;
    isActive?: boolean;
  }
): Promise<number> {
  let query = supabase
    .from("users")
    .select("id, role:roles!inner(name)", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters.role) {
    query = query.eq("roles.name", filters.role);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(
      `full_name.ilike.${searchPattern},username.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`
    );
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count || 0;
}



