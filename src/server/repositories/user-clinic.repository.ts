import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { User } from "./user.repository";
import type { Clinic } from "./clinic.repository";

export type UserClinic = Database["public"]["Tables"]["user_clinics"]["Row"];
export type InsertUserClinic = Database["public"]["Tables"]["user_clinics"]["Insert"];
export type UpdateUserClinic = Database["public"]["Tables"]["user_clinics"]["Update"];

/**
 * Finds a user-clinic assignment record (regardless of deleted_at status).
 */
export async function findAssignment(
  supabase: SupabaseClient<Database>,
  userId: string,
  clinicId: string
): Promise<UserClinic | null> {
  const { data, error } = await supabase
    .from("user_clinics")
    .select("*")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Assigns a user to a clinic. Reactivates soft-deleted rows if they exist.
 */
export async function upsertAssignment(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  clinicId: string
): Promise<UserClinic> {
  const existing = await findAssignment(supabase, userId, clinicId);
  if (existing) {
    const { data, error } = await supabase
      .from("user_clinics")
      .update({
        deleted_at: null,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data;
  }

  const { data, error } = await supabase
    .from("user_clinics")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      clinic_id: clinicId,
      assigned_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Removes user from clinic by setting deleted_at.
 */
export async function deleteAssignment(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  clinicId: string
): Promise<UserClinic> {
  const { data, error } = await supabase
    .from("user_clinics")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds all active assignments for a user.
 */
export async function findAssignmentsByUser(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string
): Promise<UserClinic[]> {
  const { data, error } = await supabase
    .from("user_clinics")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds all active assignments for a clinic.
 */
export async function findAssignmentsByClinic(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  clinicId: string
): Promise<UserClinic[]> {
  const { data, error } = await supabase
    .from("user_clinics")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Retrieves the list of active users assigned to a clinic.
 */
export async function listUsersByClinic(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  clinicId: string
): Promise<User[]> {
  const { data, error } = await supabase
    .from("user_clinics")
    .select("users!inner(*)")
    .eq("clinic_id", clinicId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("users.deleted_at", null);

  if (error) {
    throw error;
  }

  return data.map((uc: any) => uc.users);
}

/**
 * Retrieves the list of active clinics assigned to a user.
 */
export async function listClinicsByUser(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string
): Promise<Clinic[]> {
  const { data, error } = await supabase
    .from("user_clinics")
    .select("clinics!inner(*)")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("clinics.deleted_at", null);

  if (error) {
    throw error;
  }

  return data.map((uc: any) => uc.clinics);
}
