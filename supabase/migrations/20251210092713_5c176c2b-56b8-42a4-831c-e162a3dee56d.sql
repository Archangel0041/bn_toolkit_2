-- Create storage bucket for damage icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('damage-icons', 'damage-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for damage icons bucket
CREATE POLICY "Damage icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'damage-icons');

CREATE POLICY "Anyone can upload damage icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'damage-icons');

CREATE POLICY "Anyone can update damage icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'damage-icons');

CREATE POLICY "Anyone can delete damage icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'damage-icons');