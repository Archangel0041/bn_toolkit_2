-- Create policies for menu-backgrounds bucket
CREATE POLICY "Allow public read access on menu-backgrounds" ON storage.objects FOR SELECT USING (bucket_id = 'menu-backgrounds');
CREATE POLICY "Allow public upload on menu-backgrounds" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'menu-backgrounds');
CREATE POLICY "Allow public update on menu-backgrounds" ON storage.objects FOR UPDATE USING (bucket_id = 'menu-backgrounds');