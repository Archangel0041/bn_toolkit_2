-- Create storage bucket for unit images
INSERT INTO storage.buckets (id, name, public)
VALUES ('unit-images', 'unit-images', true);

-- Allow public read access to all files in the bucket
CREATE POLICY "Public read access for unit images"
ON storage.objects FOR SELECT
USING (bucket_id = 'unit-images');

-- Allow anyone to upload images (we can restrict later if needed)
CREATE POLICY "Allow public uploads to unit images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'unit-images');

-- Allow anyone to delete their uploaded images
CREATE POLICY "Allow public deletes from unit images"
ON storage.objects FOR DELETE
USING (bucket_id = 'unit-images');