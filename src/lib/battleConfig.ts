import battleConfigData from "@/data/battle_config.json";

interface ClassType {
  damage_mods: Record<string, number>;
  display_name: string;
  icon: string;
}

interface BattleConfig {
  classes: {
    class_types: Record<string, ClassType>;
    configs: {
      good_vs_cutoff: number;
      weak_vs_cutoff: number;
    };
  };
  layouts: Record<string, unknown>;
  settings: Record<string, unknown>;
}

const config = battleConfigData as BattleConfig;

export function getClassType(classId: number): ClassType | undefined {
  return config.classes.class_types[classId.toString()];
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
  return Object.entries(config.classes.class_types).map(([id, classType]) => ({
    id: parseInt(id),
    classType,
  }));
}
