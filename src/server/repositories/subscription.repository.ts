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


