import { supabase } from "@/integrations/supabase/client";
import type { Party, PartyUnit } from "@/types/battleSimulator";

/**
 * Fetch all parties for a user from the cloud
 */
export async function fetchPartiesFromCloud(): Promise<Party[]> {
  const { data, error } = await supabase
    .from("parties")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching parties from cloud:", error);
    throw error;
  }

  return (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    units: (p.units as unknown as PartyUnit[]) || [],
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
  }));
}

/**
 * Save a party to the cloud (upsert)
 */
export async function savePartyToCloud(party: Party, userId: string): Promise<void> {
  // Check if party exists
  const { data: existing } = await supabase
    .from("parties")
    .select("id")
    .eq("id", party.id)
    .maybeSingle();

  if (existing) {
    // Update existing party
    const { error } = await supabase
      .from("parties")
      .update({
        name: party.name,
        units: JSON.parse(JSON.stringify(party.units)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", party.id);

    if (error) {
      console.error("Error updating party in cloud:", error);
      throw error;
    }
  } else {
    // Insert new party
    const { error } = await supabase
      .from("parties")
      .insert({
        id: party.id,
        user_id: userId,
        name: party.name,
        units: JSON.parse(JSON.stringify(party.units)),
      });

    if (error) {
      console.error("Error inserting party to cloud:", error);
      throw error;
    }
  }
}

/**
 * Delete a party from the cloud
 */
export async function deletePartyFromCloud(partyId: string): Promise<void> {
  const { error } = await supabase
    .from("parties")
    .delete()
    .eq("id", partyId);

  if (error) {
    console.error("Error deleting party from cloud:", error);
    throw error;
  }
}
