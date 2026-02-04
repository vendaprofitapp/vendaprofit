-- Add secret area columns to store_settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS secret_area_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS secret_area_name text DEFAULT 'Área VIP',
ADD COLUMN IF NOT EXISTS secret_area_password text;

-- Add comment for documentation
COMMENT ON COLUMN public.store_settings.secret_area_active IS 'Enable/disable the secret area button in the store';
COMMENT ON COLUMN public.store_settings.secret_area_name IS 'Custom name for the secret area button';
COMMENT ON COLUMN public.store_settings.secret_area_password IS 'Password required to access secret products';