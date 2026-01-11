-- Create storage bucket for status effect icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('status-icons', 'status-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for status icons bucket
CREATE POLICY "Status icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'status-icons');

CREATE POLICY "Anyone can upload status icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'status-icons');

CREATE POLICY "Anyone can update status icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'status-icons');

CREATE POLICY "Anyone can delete status icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'status-icons');