/**
 * Battle Config - Helper functions for battle configuration
 * 
 * Uses game data from the global store (loaded from Supabase Storage)
 */

import { getBattleConfig, getClassType as getClassTypeFromStore, getAllClassTypes as getAllClassTypesFromStore } from "@/lib/gameDataStore";

interface ClassType {
  damage_mods: Record<string, number>;
  display_name: string;
  icon: string;
}

export function getClassType(classId: number): ClassType | undefined {
  return getClassTypeFromStore(classId);
}

export function getClassDisplayName(classId: number): string {
  const classType = getClassType(classId);
  if (!classType) return `Class ${classId}`;
  // Capitalize and format display name
  return classType.display_name
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getClassIcon(classId: number): string {
  const classType = getClassType(classId);
  return classType?.icon || "class_unknown";
}

export function getAllClassTypes(): { id: number; classType: ClassType }[] {
  return getAllClassTypesFromStore() as { id: number; classType: ClassType }[];
}

// Export the raw config for advanced usage
export function getRawBattleConfig(): any {
  return getBattleConfig();
}
