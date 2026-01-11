import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "Art";
const FRONT_PATH = "icons/units/front";
const BACK_PATH = "icons/units/back";

export function getUnitImageUrl(iconName: string, useBackIcon: boolean = false): string | null {
  if (!iconName) return null;

  const path = useBackIcon ? BACK_PATH : FRONT_PATH;
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${path}/${iconName}.png`);

  return data.publicUrl;
}
