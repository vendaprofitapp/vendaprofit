-- Add desktop banner height and opportunities button configuration
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS banner_height_desktop TEXT DEFAULT '120px',
ADD COLUMN IF NOT EXISTS show_opportunities_button BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS opportunities_button_text TEXT DEFAULT 'OPORTUNIDADES',
ADD COLUMN IF NOT EXISTS opportunities_button_color TEXT DEFAULT '#f97316';