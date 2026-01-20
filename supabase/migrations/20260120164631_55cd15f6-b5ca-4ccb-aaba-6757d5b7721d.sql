-- Add logo position and size settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'center',
ADD COLUMN IF NOT EXISTS logo_size TEXT DEFAULT 'medium';