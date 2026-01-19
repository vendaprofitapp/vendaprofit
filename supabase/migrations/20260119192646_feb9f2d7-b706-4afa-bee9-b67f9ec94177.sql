-- Create public storage bucket for product videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-videos',
  'product-videos',
  true,
  104857600, -- 100MB limit for videos
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
);

-- Policy: Allow public read access (anyone can view videos)
CREATE POLICY "Public can view product videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-videos');

-- Policy: Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload product videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-videos');

-- Policy: Allow authenticated users to update their videos
CREATE POLICY "Authenticated users can update product videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-videos');

-- Policy: Allow authenticated users to delete their videos
CREATE POLICY "Authenticated users can delete product videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-videos');