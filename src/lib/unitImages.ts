import { supabase } from "@/integrations/supabase/client";
import { validateFile, sanitizeFilename } from "./uploadValidation";

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

export async function uploadUnitImage(file: File, iconName: string, isBackIcon: boolean = false): Promise<{ success: boolean; error?: string }> {
  // Validate file before upload
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const path = isBackIcon ? BACK_PATH : FRONT_PATH;
  const fileName = sanitizeFilename(`${path}/${iconName}.png`);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, { upsert: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function uploadMultipleImages(
  files: FileList,
  isBackIcon: boolean = false,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = { success: 0, failed: 0, errors: [] as string[] };
  const path = isBackIcon ? BACK_PATH : FRONT_PATH;

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
    const sanitizedName = sanitizeFilename(`${path}/${iconName}.png`);

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

export async function listUploadedImages(isBackIcon: boolean = false): Promise<string[]> {
  const path = isBackIcon ? BACK_PATH : FRONT_PATH;
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(path);

  if (error || !data) return [];

  return data.map((file) => file.name.replace(/\.png$/, ""));
}
