// Tag hierarchy for targeting - children tags are valid when parent is targeted
const TAG_HIERARCHY: Record<number, number[]> = {
  51: [39, 24, 15],
  39: [52, 53, 25, 23, 9],
  52: [54, 36],
  24: [41, 38, 48, 50, 55, 11],
  50: [57, 6],
  6: [46],
  55: [18, 58],
  11: [3, 20],
  15: [28, 21, 29, 8],
  29: [17, 37, 47, 56],
  56: [1, 59],
  8: [13],
};

// Tags that should be excluded from targeting consideration
// Metal (26) - abilities don't need to specifically target Metal to hit metal units
const EXCLUDED_TARGETING_TAGS = new Set([26]);

// Get all descendant tags for a given tag (recursive)
function getDescendantTags(tag: number, visited = new Set<number>()): number[] {
  if (visited.has(tag)) return [];
  visited.add(tag);
  
  const children = TAG_HIERARCHY[tag] || [];
  const descendants: number[] = [...children];
  
  for (const child of children) {
    descendants.push(...getDescendantTags(child, visited));
  }
  
  return descendants;
}

// Expand a list of target tags to include all descendant tags
export function expandTargetTags(targetTags: number[]): number[] {
  const expanded = new Set<number>(targetTags);
  
  for (const tag of targetTags) {
    const descendants = getDescendantTags(tag);
    descendants.forEach(d => expanded.add(d));
  }
  
  return Array.from(expanded);
}

// Check if a unit's tags match any of the expanded target tags
// Excludes certain tags (like Metal) from consideration
export function unitMatchesTargets(unitTags: number[], abilityTargets: number[]): boolean {
  if (abilityTargets.length === 0) return true; // No restrictions
  
  // Filter out excluded tags from unit's tags for matching purposes
  const relevantUnitTags = unitTags.filter(tag => !EXCLUDED_TARGETING_TAGS.has(tag));
  
  // If after filtering, unit has no relevant tags, allow targeting
  // (e.g., a pure Metal unit should still be targetable)
  if (relevantUnitTags.length === 0) return true;
  
  const expandedTargets = expandTargetTags(abilityTargets);
  return relevantUnitTags.some(tag => expandedTargets.includes(tag));
}

// Get the reason why a unit is immune to an ability's targeting
// Returns null if the unit is not immune, or a description of why it's immune
export function getTargetingImmunityReason(unitTags: number[], abilityTargets: number[]): string | null {
  if (abilityTargets.length === 0) return null; // No restrictions
  
  // Filter out excluded tags from unit's tags for matching purposes
  const relevantUnitTags = unitTags.filter(tag => !EXCLUDED_TARGETING_TAGS.has(tag));
  
  // If after filtering, unit has no relevant tags, not immune
  if (relevantUnitTags.length === 0) return null;
  
  const expandedTargets = expandTargetTags(abilityTargets);
  const isImmune = !relevantUnitTags.some(tag => expandedTargets.includes(tag));
  
  if (!isImmune) return null;
  
  // Build the reason - ability requires certain tags that the unit doesn't have
  // Import would cause circular dependency, so we just return tag numbers
  // The caller can format with UnitTagLabels if needed
  return `requires ${abilityTargets.join(", ")}`;
}
