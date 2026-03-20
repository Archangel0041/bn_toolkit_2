

## Upload Boss Strike Config to Supabase Storage

The app already loads `boss_strike_config.json` from the Supabase `config` bucket (`dataLoader.ts` line 241). We just need to upload the new file to replace the existing one.

### Steps

1. **Copy the uploaded file** to a temporary location in the project
2. **Upload to Supabase Storage** — Upload the file to the `config` bucket at path `boss_strike_config.json`, replacing the existing file

This is a straightforward file upload — no code changes needed since the loading infrastructure already exists in `dataLoader.ts` → `GameDataContext.tsx` → `gameDataStore.ts` → `bossStrikes.ts`.

### Technical Detail

- **Bucket**: `config` (public)
- **Path**: `boss_strike_config.json`
- **Method**: Use Supabase Storage API to upsert the file

