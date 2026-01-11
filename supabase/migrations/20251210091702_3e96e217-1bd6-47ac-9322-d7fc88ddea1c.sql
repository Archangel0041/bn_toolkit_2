-- Create storage bucket for ability icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('ability-icons', 'ability-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for ability icons bucket
CREATE POLICY "Ability icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'ability-icons');

CREATE POLICY "Anyone can upload ability icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ability-icons');

CREATE POLICY "Anyone can update ability icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ability-icons');

CREATE POLICY "Anyone can delete ability icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'ability-icons');