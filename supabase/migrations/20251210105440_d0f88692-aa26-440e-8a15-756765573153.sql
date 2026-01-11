-- Create storage buckets for encounter and mission icons
INSERT INTO storage.buckets (id, name, public) VALUES ('encounter-icons', 'encounter-icons', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('mission-icons', 'mission-icons', true);

-- Create policies for encounter-icons bucket
CREATE POLICY "Allow public read access on encounter-icons" ON storage.objects FOR SELECT USING (bucket_id = 'encounter-icons');
CREATE POLICY "Allow public upload on encounter-icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'encounter-icons');
CREATE POLICY "Allow public update on encounter-icons" ON storage.objects FOR UPDATE USING (bucket_id = 'encounter-icons');

-- Create policies for mission-icons bucket
CREATE POLICY "Allow public read access on mission-icons" ON storage.objects FOR SELECT USING (bucket_id = 'mission-icons');
CREATE POLICY "Allow public upload on mission-icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mission-icons');
CREATE POLICY "Allow public update on mission-icons" ON storage.objects FOR UPDATE USING (bucket_id = 'mission-icons');