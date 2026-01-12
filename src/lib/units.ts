/**
 * Units - Helper functions for battle units
 * 
 * Uses game data from the global store (loaded from Supabase Storage)
 */

import { 
  getAllUnits as getAllUnitsFromStore, 
  getUnitById as getUnitByIdFromStore,
  getAllTags as getAllTagsFromStore,
  getAllSides as getAllSidesFromStore,
} from "@/lib/gameDataStore";
import type { ParsedUnit } from "@/types/units";

// Re-export the types
export type { ParsedUnit };

// Get all units - for backwards compatibility, returns the array directly
export const allUnits: ParsedUnit[] = [];

// This will be populated when the store is initialized
// For now, use the getter function
export function getAllUnits(): ParsedUnit[] {
  return getAllUnitsFromStore();
}

export function getUnitById(id: number): ParsedUnit | undefined {
  return getUnitByIdFromStore(id);
}

export function getAllTags(): number[] {
  return getAllTagsFromStore();
}

export function getAllSides(): number[] {
  return getAllSidesFromStore();
}

export function filterUnits(
  units: ParsedUnit[],
  searchQuery: string,
  selectedTags: number[],
  selectedSide: number | null,
  getLocalizedName: (key: string) => string
): ParsedUnit[] {
  return units.filter((unit) => {
    // Filter by search query (ID or localized name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const idMatch = unit.id.toString().includes(query);
      const nameMatch = getLocalizedName(unit.identity.name).toLowerCase().includes(query);
      const shortNameMatch = getLocalizedName(unit.identity.short_name).toLowerCase().includes(query);
      if (!idMatch && !nameMatch && !shortNameMatch) return false;
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      const hasAllTags = selectedTags.every((tag) => unit.identity.tags.includes(tag));
      if (!hasAllTags) return false;
    }

    // Filter by side
    if (selectedSide !== null && unit.identity.side !== selectedSide) {
      return false;
    }

    return true;
  });
}
