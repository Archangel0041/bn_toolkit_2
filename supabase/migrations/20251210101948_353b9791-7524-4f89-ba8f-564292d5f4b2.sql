-- Create storage buckets for resource icons, event reward icons, and menu backgrounds
INSERT INTO storage.buckets (id, name, public) VALUES ('resource-icons', 'resource-icons', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('event-reward-icons', 'event-reward-icons', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-backgrounds', 'menu-backgrounds', true);

-- Create policies for resource-icons bucket
CREATE POLICY "Resource icons are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'resource-icons');

CREATE POLICY "Anyone can upload resource icons" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'resource-icons');

-- Create policies for event-reward-icons bucket
CREATE POLICY "Event reward icons are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'event-reward-icons');

CREATE POLICY "Anyone can upload event reward icons" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'event-reward-icons');

-- Create policies for menu-backgrounds bucket
CREATE POLICY "Menu backgrounds are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'menu-backgrounds');

CREATE POLICY "Anyone can upload menu backgrounds" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'menu-backgrounds');