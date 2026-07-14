import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type UserCompensation = Database["public"]["Tables"]["user_compensations"]["Row"];
export type InsertUserCompensation = Database["public"]["Tables"]["user_compensations"]["Insert"];
export type UpdateUserCompensation = Database["public"]["Tables"]["user_compensations"]["Update"];

/**
 * Inserts a new compensation record for a user.
 */
export async function insertUserCompensation(
  supabase: SupabaseClient<Database>,
  compensation: InsertUserCompensation
): Promise<UserCompensation> {
  const { data, error } = await supabase
    .from("user_compensations")
    .insert(compensation)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing compensation record.
 */
export async function updateUserCompensation(
  supabase: SupabaseClient<Database>,
  compensationId: string,
  compensation: UpdateUserCompensation
): Promise<UserCompensation> {
  const { data, error } = await supabase
    .from("user_compensations")
    .update(compensation)
    .eq("id", compensationId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists every compensation record for a user, ordered oldest-first, for
 * in-memory effective-date resolution across a batch of appointments
 * (avoids one query per appointment in commission calculation).
 */
export async function listCompensationsByUser(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string
): Promise<UserCompensation[]> {
  const { data, error } = await supabase
    .from("user_compensations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("effective_from", { ascending: true });

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds the compensation record in effect for a user as of a given date:
 * the row with the latest effective_from on or before asOfDate. Returns
 * null if no compensation record exists that early.
 */
export async function findEffectiveCompensation(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  asOfDate: string
): Promise<UserCompensation | null> {
  const { data, error } = await supabase
    .from("user_compensations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .lte("effective_from", asOfDate)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}
