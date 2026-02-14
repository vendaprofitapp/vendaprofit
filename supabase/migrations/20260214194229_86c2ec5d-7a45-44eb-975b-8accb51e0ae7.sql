
-- Add feed_token column to store_settings for public feed authentication
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS feed_token text DEFAULT substring(md5(random()::text), 1, 24);

-- Backfill existing rows that might have NULL
UPDATE public.store_settings
SET feed_token = substring(md5(random()::text), 1, 24)
WHERE feed_token IS NULL;
