-- Add video bubble columns to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS bio_video_preview TEXT,
ADD COLUMN IF NOT EXISTS bio_video_full TEXT;