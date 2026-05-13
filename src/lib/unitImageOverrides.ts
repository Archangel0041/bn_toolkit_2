/**
 * Manual icon overrides for units whose `identity.icon` is missing or wrong
 * in the source data. Keyed by unit id; value is a bundled asset URL.
 *
 * To add a new override:
 *   1. Drop the PNG into src/assets/unit-overrides/
 *   2. import it here and add the id -> url mapping
 *
 * The override pipeline:
 *   - parseUnit() injects a sentinel iconName (`__override__<id>`) into
 *     identity.icon when the id is in this map.
 *   - getUnitImageUrl() detects the sentinel and returns the bundled URL
 *     instead of building a Supabase storage URL.
 */

import ramsey212 from "@/assets/unit-overrides/ramsey_212.png";

export const OVERRIDE_SENTINEL_PREFIX = "__override__";

export const UNIT_ICON_OVERRIDES: Record<number, string> = {
  212: ramsey212,
};

export function getUnitOverrideUrl(unitId: number): string | undefined {
  return UNIT_ICON_OVERRIDES[unitId];
}

export function makeOverrideSentinel(unitId: number): string {
  return `${OVERRIDE_SENTINEL_PREFIX}${unitId}`;
}

export function parseOverrideSentinel(iconName: string): number | null {
  if (!iconName.startsWith(OVERRIDE_SENTINEL_PREFIX)) return null;
  const id = parseInt(iconName.slice(OVERRIDE_SENTINEL_PREFIX.length), 10);
  return Number.isFinite(id) ? id : null;
}
