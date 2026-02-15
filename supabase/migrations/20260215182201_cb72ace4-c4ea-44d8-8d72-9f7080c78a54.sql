
-- 1. Add address fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text;

-- 2. Create bazar_items table
CREATE TABLE public.bazar_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  seller_phone text NOT NULL,
  seller_name text,
  title text NOT NULL,
  description text,
  seller_price numeric NOT NULL,
  store_commission numeric,
  final_price numeric,
  weight_grams integer NOT NULL,
  height_cm integer NOT NULL,
  width_cm integer NOT NULL,
  length_cm integer NOT NULL,
  image_url text,
  image_url_2 text,
  image_url_3 text,
  status text NOT NULL DEFAULT 'pending',
  seller_zip text,
  seller_street text,
  seller_number text,
  seller_neighborhood text,
  seller_city text,
  seller_state text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bazar_items ENABLE ROW LEVEL SECURITY;

-- RLS: Owner can see their items
CREATE POLICY "Owner can view bazar items"
  ON public.bazar_items FOR SELECT
  USING (owner_id = auth.uid());

-- RLS: Anyone can insert (public catalog form)
CREATE POLICY "Anyone can submit bazar items"
  ON public.bazar_items FOR INSERT
  WITH CHECK (true);

-- RLS: Owner can update (approve/reject)
CREATE POLICY "Owner can update bazar items"
  ON public.bazar_items FOR UPDATE
  USING (owner_id = auth.uid());

-- RLS: Owner can delete
CREATE POLICY "Owner can delete bazar items"
  ON public.bazar_items FOR DELETE
  USING (owner_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_bazar_items_updated_at
  BEFORE UPDATE ON public.bazar_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create bazar-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bazar-images', 'bazar-images', true);

-- Storage: Anyone can upload to bazar-images
CREATE POLICY "Anyone can upload bazar images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bazar-images');

-- Storage: Public read
CREATE POLICY "Public read bazar images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bazar-images');
