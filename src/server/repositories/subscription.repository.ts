import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
export type InsertSubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Insert"];
export type UpdateSubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Update"];

/**
 * Finds a subscription plan by its unique name.
 *
 * @param supabase - The Supabase client.
 * @param name - The name of the subscription plan.
 * @returns The subscription plan if found, or null.
 */
export async function findSubscriptionPlanByName(
  supabase: SupabaseClient<Database>,
  name: string
): Promise<SubscriptionPlan | null> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("plan_name", name)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a subscription plan by ID.
 *
 * @param supabase - The Supabase client.
 * @param planId - The ID of the subscription plan.
 * @returns The subscription plan if found, or null.
 */
export async function findSubscriptionPlanById(
  supabase: SupabaseClient<Database>,
  planId: string
): Promise<SubscriptionPlan | null> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists the plan catalog available for self-service selection: active
 * (non-deleted) plans, excluding the internal `NO_SUBSCRIPTION` marker
 * plan -- mirrors `selectSubscriptionPlan`'s own guard against selecting it
 * directly. Ordered by monthly_price so Trial (0) sorts first.
 */
export async function listSubscriptionPlans(supabase: SupabaseClient<Database>): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .is("deleted_at", null)
    .neq("plan_name", "NO_SUBSCRIPTION")
    .order("monthly_price", { ascending: true });

  if (error) {
    throw error;
  }
  return data;
}


