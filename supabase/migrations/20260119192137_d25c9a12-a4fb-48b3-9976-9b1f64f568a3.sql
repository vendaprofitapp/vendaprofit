-- Add font customization columns to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS font_heading text DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS font_body text DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS custom_font_url text,
ADD COLUMN IF NOT EXISTS custom_font_name text;

-- Create storage bucket for custom fonts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('store-fonts', 'store-fonts', true, 5242880, ARRAY['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/x-font-ttf', 'application/x-font-otf', 'application/font-woff', 'application/font-woff2', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Create policies for font uploads
CREATE POLICY "Anyone can view fonts" ON storage.objects FOR SELECT USING (bucket_id = 'store-fonts');

CREATE POLICY "Users can upload their own fonts" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'store-fonts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own fonts" ON storage.objects 
FOR UPDATE USING (bucket_id = 'store-fonts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own fonts" ON storage.objects 
FOR DELETE USING (bucket_id = 'store-fonts' AND auth.uid()::text = (storage.foldername(name))[1]);