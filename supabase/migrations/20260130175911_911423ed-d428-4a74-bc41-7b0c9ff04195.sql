-- Create storage bucket for marketing videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-videos', 'marketing-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can view marketing videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-videos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload marketing videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketing-videos' AND auth.role() = 'authenticated');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own marketing videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'marketing-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own marketing videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'marketing-videos' AND auth.uid()::text = (storage.foldername(name))[1]);