// Shared upload validation utilities for client-side defense in depth
// Server-side validation is enforced via Supabase bucket settings

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_FILENAME_LENGTH = 200;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): ValidationResult {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large (max 5MB): ${file.name}` };
  }
  
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type (${file.type}): ${file.name}` };
  }
  
  // Validate filename length
  if (file.name.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: `Filename too long (max 200 chars): ${file.name}` };
  }
  
  return { valid: true };
}

export function sanitizeFilename(name: string): string {
  return name
    .substring(0, MAX_FILENAME_LENGTH)
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Remove special chars
    .replace(/\.\./g, '_'); // Prevent path traversal
}

export function validateAndSanitizeFilename(file: File): { sanitizedName: string; validation: ValidationResult } {
  const validation = validateFile(file);
  const sanitizedName = sanitizeFilename(file.name);
  return { sanitizedName, validation };
}
