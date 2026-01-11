import { supabase } from "@/integrations/supabase/client";
import { validateFile, sanitizeFilename } from "./uploadValidation";

const BUCKET_NAME = "Art";
const ABILITY_PATH = "icons/abilities";

export function getAbilityImageUrl(iconName: string): string | null {
  if (!iconName) return null;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${ABILITY_PATH}/${iconName}.png`);

  return data.publicUrl;
}

export async function uploadMultipleAbilityImages(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      results.failed++;
      results.errors.push(validation.error || `Invalid file: ${file.name}`);
      continue;
    }

    const iconName = file.name.replace(/\.(png|jpg|jpeg|webp|gif)$/i, "");
    const sanitizedName = sanitizeFilename(`${ABILITY_PATH}/${iconName}.png`);

    onProgress?.(i + 1, files.length, file.name);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(sanitizedName, file, { upsert: true });

    if (error) {
      results.failed++;
      results.errors.push(`${file.name}: ${error.message}`);
    } else {
      results.success++;
    }
  }

  return results;
}

export async function listUploadedAbilityImages(): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(ABILITY_PATH);

  if (error || !data) return [];

  return data.map((file) => file.name.replace(/\.png$/, ""));
}
