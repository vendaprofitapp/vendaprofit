
CREATE TABLE public.featured_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (owner_id, product_id),
  UNIQUE (owner_id, position)
);

ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own featured products"
  ON public.featured_products FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can manage their own featured products"
  ON public.featured_products FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own featured products"
  ON public.featured_products FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own featured products"
  ON public.featured_products FOR DELETE
  USING (auth.uid() = owner_id);

-- Public read for catalog visitors
CREATE POLICY "Public can view featured products"
  ON public.featured_products FOR SELECT
  USING (true);
