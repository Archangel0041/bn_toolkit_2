import bossStrikeData from "@/data/boss_strike_config.json";
import archivedBossStrikeData from "@/data/boss_strike_config_archived.json";
import type { BossStrike, BossStrikeData, TierInfo } from "@/types/bossStrike";
import { getEncounterById } from "@/lib/encounters";

const currentData = bossStrikeData as unknown as BossStrikeData;
const archivedData = archivedBossStrikeData as unknown as BossStrikeData;

export function getBossStrikeById(id: number | string, archived = false): BossStrike | undefined {
  const data = archived ? archivedData : currentData;
  return data[String(id)];
}

export function getAllBossStrikeIds(archived = false): string[] {
  const data = archived ? archivedData : currentData;
  return Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
}

export function getAllCurrentBossStrikeIds(): string[] {
  return getAllBossStrikeIds(false);
}

export function getAllArchivedBossStrikeIds(): string[] {
  return getAllBossStrikeIds(true);
}

export function getBossStrikeName(bossStrike: BossStrike): string | undefined {
  // Get name from the first encounter of the first tier
  if (bossStrike.tier_info && bossStrike.tier_info.length > 0) {
    const firstTier = bossStrike.tier_info[0];
    if (firstTier.encounters && firstTier.encounters.length > 0) {
      const firstEncounterId = firstTier.encounters[0].encounter_id;
      const encounter = getEncounterById(firstEncounterId);
      return encounter?.name;
    }
  }
  return undefined;
}

export function getTierEncountersByLevelRange(tier: TierInfo): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  
  tier.encounters.forEach(enc => {
    const minLevel = enc.min_level ?? 1;
    const key = `${minLevel}-${enc.max_level}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(enc.encounter_id);
  });
  
  return grouped;
}

export function formatRewards(rewards: TierInfo["rewards"]): { type: string; key: string; amount: number }[] {
  const formatted: { type: string; key: string; amount: number }[] = [];
  
  if (rewards.resources) {
    Object.entries(rewards.resources).forEach(([key, amount]) => {
      if (typeof amount === 'number') {
        formatted.push({ type: "resource", key, amount });
      }
    });
  }
  
  // Handle units - can be array of IDs or object
  if (rewards.units) {
    if (Array.isArray(rewards.units)) {
      rewards.units.forEach(unitId => {
        formatted.push({ type: "unit", key: String(unitId), amount: 1 });
      });
    } else if (typeof rewards.units === 'object') {
      Object.entries(rewards.units as Record<string, number>).forEach(([key, amount]) => {
        formatted.push({ type: "unit", key, amount: typeof amount === 'number' ? amount : 1 });
      });
    }
  }
  
  if (rewards.items) {
    Object.entries(rewards.items).forEach(([key, amount]) => {
      if (typeof amount === 'number') {
        formatted.push({ type: "item", key, amount });
      }
    });
  }
  
  return formatted;
}
