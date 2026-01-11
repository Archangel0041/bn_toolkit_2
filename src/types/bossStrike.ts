export interface ProgressCost {
  awarded_points: number;
  cost: Record<string, number>;
}

export interface GuildWeight {
  percent: number;
  min_guild_size: number;
  max_guild_size: number;
}

export interface TierEncounter {
  encounter_id: number;
  max_level: number;
  min_level?: number;
}

export interface TierRewards {
  resources?: Record<string, number>;
  units?: number[];
  items?: Record<string, number>;
}

export interface TierInfo {
  encounters: TierEncounter[];
  required_completion_points: number;
  reward_image?: string;
  rewards: TierRewards;
  tier_progress_cost?: ProgressCost;
}

export interface GlobalEventEncounter {
  encounter_id: number;
  max_level: number;
}

export interface BossStrike {
  default_progress_cost?: ProgressCost;
  global_event_encounters?: GlobalEventEncounter[];
  guild_weights?: GuildWeight[];
  mission_icon?: string;
  tier_info?: TierInfo[];
  menu_bg?: string;
  name?: string;
}

export type BossStrikeData = Record<string, BossStrike>;
