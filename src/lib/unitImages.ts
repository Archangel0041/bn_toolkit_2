import { supabase } from "@/integrations/supabase/client";
import { getUnitOverrideUrl, parseOverrideSentinel } from "@/lib/unitImageOverrides";

const BUCKET_NAME = "Art";
const FRONT_PATH = "icons/units/front";
const BACK_PATH = "icons/units/back";
const ABILITY_PATH = "icons/abilities";

export function getUnitImageUrl(iconName: string, useBackIcon: boolean = false): string | null {
  if (!iconName) return null;

  // Manual override (e.g. units with no/missing icon in the source data).
  const overrideId = parseOverrideSentinel(iconName);
  if (overrideId !== null) {
    return getUnitOverrideUrl(overrideId) ?? null;
  }

  // Some units (e.g. Kraken body #104-107) reference an ability icon as their
  // front icon. Detect that by the `unit_ability_` prefix and pull from the
  // abilities folder instead of the units folder.
  const isAbilityIcon = !useBackIcon && iconName.startsWith("unit_ability_");
  const path = isAbilityIcon ? ABILITY_PATH : useBackIcon ? BACK_PATH : FRONT_PATH;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${path}/${iconName}.png`);

  return data.publicUrl;
}
