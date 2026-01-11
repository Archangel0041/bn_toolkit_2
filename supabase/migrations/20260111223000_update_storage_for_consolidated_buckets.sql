-- Update storage policies for consolidated bucket structure
-- Old structure: 9 separate buckets (unit-images, ability-icons, etc.)
-- New structure: 2 main buckets (Art, config, Localizations)

-- Drop old storage policies (if they exist from old bucket structure)
DROP POLICY IF EXISTS "Uploaders can upload to unit-images" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update unit-images" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to ability-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update ability-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to damage-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update damage-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to status-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update status-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to resource-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update resource-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to event-reward-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update event-reward-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to menu-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update menu-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to encounter-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update encounter-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload to mission-icons" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update mission-icons" ON storage.objects;

-- Create new policies for Art bucket
-- Uploaders (admin or uploader role) can upload/update images
CREATE POLICY "Uploaders can upload to Art bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Art' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update Art bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'Art' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can delete from Art bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'Art' AND public.can_upload(auth.uid()));

-- Everyone can read from Art bucket (public assets)
CREATE POLICY "Anyone can view Art bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'Art');

-- Create policies for config bucket
CREATE POLICY "Uploaders can upload to config bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'config' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update config bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'config' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can delete from config bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'config' AND public.can_upload(auth.uid()));

-- Everyone can read from config bucket (game configuration data)
CREATE POLICY "Anyone can view config bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'config');

-- Create policies for Localizations bucket
CREATE POLICY "Uploaders can upload to Localizations bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Localizations' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update Localizations bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'Localizations' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can delete from Localizations bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'Localizations' AND public.can_upload(auth.uid()));

-- Everyone can read from Localizations bucket (localization files)
CREATE POLICY "Anyone can view Localizations bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'Localizations');
