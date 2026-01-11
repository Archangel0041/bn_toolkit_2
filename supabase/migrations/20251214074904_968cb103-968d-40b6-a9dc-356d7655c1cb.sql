-- Secure storage buckets: Add file size limits and allowed MIME types
UPDATE storage.buckets 
SET file_size_limit = 5242880, -- 5MB in bytes
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE id IN ('unit-images', 'ability-icons', 'damage-icons', 
             'status-icons', 'resource-icons', 'event-reward-icons',
             'menu-backgrounds', 'encounter-icons', 'mission-icons');

-- Remove permissive INSERT policies
DROP POLICY IF EXISTS "Allow public uploads to unit images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload ability icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload damage icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload status icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload resource icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload event reward icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload menu backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload on encounter-icons" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload on menu-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload on mission-icons" ON storage.objects;

-- Remove permissive UPDATE policies
DROP POLICY IF EXISTS "Anyone can update ability icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update damage icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update status icons" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on encounter-icons" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on menu-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on mission-icons" ON storage.objects;

-- Remove permissive DELETE policies
DROP POLICY IF EXISTS "Allow public deletes from unit images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete ability icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete damage icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete status icons" ON storage.objects;