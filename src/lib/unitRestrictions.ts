import battleConfig from "@/data/battle_config.json";
import { getUnitById } from "@/lib/units";
import type { PartyUnit } from "@/types/battleSimulator";
import type { Encounter } from "@/types/encounters";

interface UnitTagMetadata {
  deploy_limit?: number;
  show_in_ui?: boolean;
  unit_tag_string_id?: string;
}

// Get deploy limits from battle_config
export function getTagDeployLimits(): Map<number, { limit: number; stringId: string }> {
  const limits = new Map<number, { limit: number; stringId: string }>();
  
  const metadata = (battleConfig as any).settings?.unit_tag_metadata || {};
  
  for (const [tagIdStr, data] of Object.entries(metadata)) {
    const tagData = data as UnitTagMetadata;
    if (tagData.deploy_limit !== undefined) {
      limits.set(parseInt(tagIdStr), {
        limit: tagData.deploy_limit,
        stringId: tagData.unit_tag_string_id || `Tag ${tagIdStr}`,
      });
    }
  }
  
  return limits;
}

// Count units by tag in party
export function countUnitsByTag(units: PartyUnit[]): Map<number, number> {
  const counts = new Map<number, number>();
  
  for (const partyUnit of units) {
    const unit = getUnitById(partyUnit.unitId);
    if (!unit) continue;
    
    for (const tag of unit.identity.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  
  return counts;
}

// Check if adding a unit would exceed any deploy limits
export function checkDeployLimits(
  unitId: number,
  currentUnits: PartyUnit[]
): { allowed: boolean; violations: { tagId: number; stringId: string; limit: number; current: number }[] } {
  const unit = getUnitById(unitId);
  if (!unit) return { allowed: true, violations: [] };
  
  const limits = getTagDeployLimits();
  const currentCounts = countUnitsByTag(currentUnits);
  const violations: { tagId: number; stringId: string; limit: number; current: number }[] = [];
  
  for (const tag of unit.identity.tags) {
    const limitData = limits.get(tag);
    if (!limitData) continue;
    
    const currentCount = currentCounts.get(tag) || 0;
    if (currentCount >= limitData.limit) {
      violations.push({
        tagId: tag,
        stringId: limitData.stringId,
        limit: limitData.limit,
        current: currentCount,
      });
    }
  }
  
  return {
    allowed: violations.length === 0,
    violations,
  };
}

// Get encounter unit limit
export function getEncounterUnitLimit(encounter: Encounter): number {
  // attacker_slots is the player's unit limit
  return encounter.attacker_slots || 13; // Default to 13 (max grid capacity)
}

// Check if party exceeds encounter unit limit
export function checkEncounterUnitLimit(
  encounter: Encounter,
  currentUnits: PartyUnit[]
): { allowed: boolean; limit: number; current: number } {
  const limit = getEncounterUnitLimit(encounter);
  const current = currentUnits.length;
  
  return {
    allowed: current < limit,
    limit,
    current,
  };
}

// Get all restriction messages for current party
export function getRestrictionMessages(
  encounter: Encounter | null,
  currentUnits: PartyUnit[],
  t: (key: string) => string
): string[] {
  const messages: string[] = [];
  
  // Check encounter limit
  if (encounter) {
    const limitCheck = checkEncounterUnitLimit(encounter, currentUnits);
    if (!limitCheck.allowed) {
      messages.push(`Unit limit reached: ${limitCheck.current}/${limitCheck.limit}`);
    }
  }
  
  // Check tag deploy limits
  const limits = getTagDeployLimits();
  const counts = countUnitsByTag(currentUnits);
  
  for (const [tagId, count] of counts) {
    const limitData = limits.get(tagId);
    if (limitData && count >= limitData.limit) {
      const tagName = t(limitData.stringId);
      messages.push(`${tagName}: ${count}/${limitData.limit}`);
    }
  }
  
  return messages;
}
