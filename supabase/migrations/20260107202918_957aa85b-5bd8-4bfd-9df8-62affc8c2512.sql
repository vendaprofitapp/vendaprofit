-- Create store_settings table for catalog configuration
CREATE TABLE public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  store_slug TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  store_description TEXT,
  whatsapp_number TEXT,
  show_own_products BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create store_partnerships to select which groups to show in catalog
CREATE TABLE public.store_partnerships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, group_id)
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_partnerships ENABLE ROW LEVEL SECURITY;

-- Store settings policies
CREATE POLICY "Users can view own store settings"
ON public.store_settings FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own store settings"
ON public.store_settings FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own store settings"
ON public.store_settings FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own store settings"
ON public.store_settings FOR DELETE
USING (owner_id = auth.uid());

-- Public can view active stores by slug
CREATE POLICY "Public can view active stores"
ON public.store_settings FOR SELECT
USING (is_active = true);

-- Store partnerships policies
CREATE POLICY "Users can manage own store partnerships"
ON public.store_partnerships FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.store_settings ss
  WHERE ss.id = store_partnerships.store_id
  AND ss.owner_id = auth.uid()
));

CREATE POLICY "Public can view store partnerships"
ON public.store_partnerships FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.store_settings ss
  WHERE ss.id = store_partnerships.store_id
  AND ss.is_active = true
));

-- Add policy for public product viewing
CREATE POLICY "Public can view products in active stores"
ON public.products FOR SELECT
USING (
  is_active = true AND (
    -- Own products shown in active stores
    EXISTS (
      SELECT 1 FROM public.store_settings ss
      WHERE ss.owner_id = products.owner_id
      AND ss.is_active = true
      AND ss.show_own_products = true
    )
    OR
    -- Products from partnerships shown in stores
    EXISTS (
      SELECT 1 FROM public.product_partnerships pp
      JOIN public.store_partnerships sp ON sp.group_id = pp.group_id
      JOIN public.store_settings ss ON ss.id = sp.store_id
      WHERE pp.product_id = products.id
      AND ss.is_active = true
    )
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();