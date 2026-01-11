export interface EncounterUnit {
  grid_id?: number;
  unit_id: number;
  wave_number?: number;
}

export interface EncounterWave {
  units?: EncounterUnit[];
}

export interface Encounter {
  attacker_defense_slots?: number;
  attacker_slots?: number; // Unit limit for player
  bg_image?: string;
  exclude_tag?: number;
  hide_heal_button?: boolean;
  icon?: string;
  is_player_attacker?: boolean;
  layout_id?: number;
  level?: number;
  name?: string;
  occupation_size?: { x: number; y: number };
  placement?: { _t: string };
  player_units?: EncounterUnit[];
  regen?: boolean;
  rewards_ref?: number;
  units?: EncounterUnit[];
  waves?: EncounterWave[];
  enemy_ai_type?: number;
  // Environmental status effect that applies to all units
  environmental_status_effect?: number;
  [key: string]: unknown; // Allow additional properties
}

export interface EncountersData {
  armies: Record<string, Encounter>;
  tables?: unknown;
}

// Grid layout constants
export const GRID_LAYOUT = {
  ROW_1: [4, 3, 2, 1, 0], // Visual left-to-right maps to grid IDs 4,3,2,1,0
  ROW_2: [9, 8, 7, 6, 5], // Visual left-to-right maps to grid IDs 9,8,7,6,5
  ROW_3: [13, 12, 11],    // Visual left-to-right maps to grid IDs 13,12,11 (3 centered slots)
} as const;

export const ALL_GRID_POSITIONS = [...GRID_LAYOUT.ROW_1, ...GRID_LAYOUT.ROW_2, ...GRID_LAYOUT.ROW_3];
