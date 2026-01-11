import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "Art";
const ABILITY_PATH = "icons/abilities";

export function getAbilityImageUrl(iconName: string): string | null {
  if (!iconName) return null;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${ABILITY_PATH}/${iconName}.png`);

  return data.publicUrl;
}
