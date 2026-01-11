# Supabase Setup Guide

This guide will help you migrate from Lovable's Supabase instance to your own Supabase account.

## Prerequisites

- A Supabase account ([sign up at supabase.com](https://supabase.com))
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (optional but recommended)
- Node.js and npm installed

## Step 1: Create a New Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in the project details:
   - **Project Name**: Battle Nations Toolkit (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
4. Wait for the project to be created (takes ~2 minutes)

## Step 2: Get Your Project Credentials

Once your project is ready:

1. Go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Project API keys** → **anon public** key
   - **Project ID** (from the URL or Project Settings → General)

## Step 3: Update Environment Variables

Create or update your `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

**IMPORTANT**: Never commit the `.env` file to git. Make sure it's in your `.gitignore`.

## Step 4: Run Database Migrations

### Option A: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref your-project-id
   ```
   You'll be prompted for your database password.

4. **Run migrations**:
   ```bash
   supabase db push
   ```

5. **Verify migrations**:
   ```bash
   supabase db diff
   ```
   This should show no differences if all migrations were applied.

### Option B: Manual Migration via SQL Editor

If you prefer not to use the CLI:

1. Go to your Supabase Dashboard → **SQL Editor**
2. Run each migration file in order (by timestamp):
   - Open each file in `supabase/migrations/` folder
   - Copy the SQL content
   - Paste and execute in the SQL Editor
   - Repeat for all migration files in chronological order

**Migration files order** (run in this sequence):
```
20251210081315_08954794-0bbf-4ae6-bbd8-15b600d0651b.sql
20251210091702_3e96e217-1bd6-47ac-9322-d7fc88ddea1c.sql
20251210092713_5c176c2b-56b8-42a4-831c-e162a3dee56d.sql
20251210094527_c4abed7e-6c1d-4c56-9e55-080ad04f980c.sql
20251210101948_353b9791-7524-4f89-ba8f-564292d5f4b2.sql
20251210105440_d0f88692-aa26-440e-8a15-756765573153.sql
20251210110604_1162b4ef-4876-48d8-8e5b-dc4fca4af887.sql
20251214074904_968cb103-968d-40b6-a9dc-356d7655c1cb.sql
20251214075632_e5a5d1ef-74d4-42b0-bf76-1665652e91ed.sql
20251214081200_6da4190b-fbb7-4ba0-a92f-2740523ad107.sql
20251214104939_9d488e8f-bdbc-4f58-a812-9c18b3d7b318.sql
20251215034900_f7a24e82-3b79-4dfb-af76-d6410eb16b48.sql
20260111211235_27687ab8-c9ed-4ae0-a390-65fb828890c9.sql
20260111211546_286e10dc-097c-4d5c-9bec-e4d5aa36e677.sql
20260111211933_d600f8f7-4974-4d7b-b302-48253a502ea4.sql
20260111212814_e294facd-10cc-4adf-a0d3-780ad90aa2b8.sql
20260111220500_add_invite_code_tracking.sql
20260111223000_update_storage_for_consolidated_buckets.sql
```

## Step 5: Configure Authentication

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. **Enable Email provider**:
   - Turn on "Enable Email provider"
   - **Enable Email OTP** (passwordless authentication)
   - Configure email templates if desired

3. **Configure Email Settings** (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize the OTP email template with your branding

4. **Set up redirects**:
   - Go to **Authentication** → **URL Configuration**
   - Add your site URL (e.g., `http://localhost:8080` for local dev)
   - Add redirect URLs as needed

## Step 6: Create Storage Buckets

Your app uses a consolidated bucket structure for better organization. Create them in **Storage** → **Buckets**:

### Required Buckets:

1. **Art** (Public bucket)
   - Contains all game art assets organized in folders
   - Folder structure:
     ```
     Art/
       icons/
         units/
           front/     (enemy unit icons)
           back/      (player unit icons)
         abilities/   (ability icons)
         status_effects/  (status effect icons)
         bn_resources/    (resource icons)
         rewards/         (event reward icons)
         boss_strikes/    (menu background images)
         encounters/      (encounter icons)
         missions/        (mission icons)
       ui/              (UI elements like damage icons)
     ```

2. **config** (Public bucket)
   - Contains game configuration files (battle_units.json, etc.)
   - Folder structure:
     ```
     config/
       (various .json config files)
     ```

3. **Localizations** (Public bucket)
   - Contains localization and translation files
   - Folder structure:
     ```
     Localizations/
       tables/
         (GameTextSharedData and other localization files)
     ```

### Bucket Configuration:

For each bucket:
- **Name**: Use the exact names above (`Art`, `config`, `Localizations`)
- **Public bucket**: ✅ Check this box (allows public read access)
- **File size limit**:
  - `Art`: 5MB (for images)
  - `config`: 10MB (for JSON files)
  - `Localizations`: 10MB (for localization files)
- **Allowed MIME types**:
  - `Art`: `image/*`
  - `config`: `application/json, text/*`
  - `Localizations`: `application/json, text/*`

### Storage Policies

The storage policies for uploaders are already created by the migrations. These policies ensure that:
- Only users with `admin` or `uploader` roles can upload/update/delete files
- Anyone can view files (public buckets for game assets)
- Row Level Security (RLS) is enforced via the `can_upload()` function

## Step 7: Set Up Your First Admin User

After your first user signs up, you need to grant them admin access:

1. Go to **SQL Editor** in your Supabase dashboard
2. Find the user's ID from the **Authentication** → **Users** page
3. Run this SQL to grant admin role:

```sql
INSERT INTO public.user_roles (user_id, role, granted_by)
VALUES ('your-user-id-here', 'admin', 'your-user-id-here');
```

Replace `'your-user-id-here'` with the actual UUID of your user.

## Step 8: Test Your Application

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Test authentication**:
   - Try signing up with email OTP
   - Check that you receive the OTP email
   - Complete the sign-in process

3. **Test permissions**:
   - As an admin user, test creating invite codes
   - Test uploading images to storage buckets
   - Create and manage battle parties

4. **Verify database**:
   - Check that profiles are created automatically
   - Verify that RLS policies are working correctly

## Step 9: Data Migration (Optional)

If you have existing data in Lovable's Supabase that you want to migrate:

### Export from Lovable Supabase:

1. Use Supabase dashboard or CLI to export data:
   ```bash
   # Export specific tables
   pg_dump -h db.xxx.supabase.co -U postgres -t public.profiles -t public.parties -t public.invite_codes -t public.user_roles --data-only > data_export.sql
   ```

2. Or use the Supabase dashboard:
   - Go to **SQL Editor**
   - Run `SELECT * FROM table_name` for each table
   - Export as CSV

### Import to Your Supabase:

1. **Using SQL**:
   ```bash
   psql -h db.your-project.supabase.co -U postgres -d postgres < data_export.sql
   ```

2. **Or via Dashboard**:
   - Go to **Table Editor**
   - Select the table
   - Click "Insert" → "Import from CSV"

**NOTE**: Make sure to disable triggers during import to avoid conflicts, especially for the `handle_new_user` trigger.

## Step 10: Production Deployment

### Environment Variables for Production:

When deploying to production (Vercel, Netlify, etc.), set these environment variables:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Update Authentication URLs:

In your Supabase dashboard, add your production URL:
- Go to **Authentication** → **URL Configuration**
- Add your production URL (e.g., `https://yourdomain.com`)
- Add redirect URLs

### Production Checklist:

- [ ] All environment variables are set correctly
- [ ] Authentication redirect URLs are configured
- [ ] Storage buckets are created and public
- [ ] At least one admin user exists
- [ ] Email provider is configured and tested
- [ ] RLS policies are enabled on all tables
- [ ] Migrations are applied successfully

## Database Schema Overview

Your database includes:

### Tables:
- **profiles** - User profile information
- **user_roles** - Role-based access control (admin, uploader)
- **invite_codes** - Invitation system for user registration
- **parties** - User's saved battle party configurations

### Functions:
- `has_role(user_id, role)` - Check if user has a specific role
- `can_upload(user_id)` - Check if user can upload images
- `use_invite_code(code, email)` - Validate and use an invite code
- `can_use_invite_code(code, email)` - Check if email can use a code
- `handle_new_user()` - Automatically create profile on signup

### Storage Buckets:
- **Art** - Consolidated bucket for all game art assets
  - Organized with folder structure: units (front/back), abilities, status effects, resources, rewards, boss strikes, encounters, missions, UI elements
- **config** - Game configuration JSON files
- **Localizations** - Translation and localization files

All buckets are public (read access) with upload/update/delete restricted to users with admin or uploader roles.

### Row Level Security (RLS):
All tables have RLS enabled with appropriate policies for data security. Storage buckets use RLS via the `can_upload()` function to restrict write access.

## Troubleshooting

### "Invalid JWT" errors:
- Make sure your `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct
- Clear browser cache and localStorage
- Verify the JWT expiration settings in Supabase Auth settings

### Storage upload failures:
- Ensure buckets are created and set to public
- Verify your user has `admin` or `uploader` role
- Check storage policies are applied (they should be from migrations)

### Migration errors:
- Run migrations in chronological order
- Check for duplicate objects if re-running migrations
- Use `DROP IF EXISTS` to clean up before re-running

### Can't log in:
- Verify email OTP is enabled in Auth settings
- Check spam folder for OTP emails
- Verify redirect URLs are configured correctly

## Security Best Practices

1. **Never commit `.env` files** - Always use `.gitignore`
2. **Use environment-specific keys** - Different keys for dev/staging/production
3. **Regularly rotate API keys** - Especially if exposed
4. **Monitor usage** - Set up alerts in Supabase dashboard
5. **Keep migrations in version control** - Always commit migration files
6. **Use service role keys carefully** - Only in server-side code, never in frontend
7. **Review RLS policies** - Ensure data access is properly restricted

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Documentation](https://supabase.com/docs/guides/storage)

## Support

If you encounter issues:
1. Check the [Supabase Discord](https://discord.supabase.com)
2. Review [Supabase Discussions](https://github.com/supabase/supabase/discussions)
3. Search existing GitHub issues

---

**Created**: 2026-01-11
**Last Updated**: 2026-01-11
