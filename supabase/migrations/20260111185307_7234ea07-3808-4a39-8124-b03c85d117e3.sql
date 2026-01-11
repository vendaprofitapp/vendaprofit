-- Create product_variants table for size/stock management
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  sku TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, size)
);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies that inherit from product ownership
CREATE POLICY "Users can view variants of own products"
ON public.product_variants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can insert variants for own products"
ON public.product_variants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update variants of own products"
ON public.product_variants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete variants of own products"
ON public.product_variants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.owner_id = auth.uid()
  )
);

-- Policy for public catalog view
CREATE POLICY "Public can view variants of active products in stores"
ON public.product_variants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.store_settings s ON s.owner_id = p.owner_id
    WHERE p.id = product_variants.product_id 
    AND p.is_active = true 
    AND s.is_active = true
  )
);

-- Policy for group members
CREATE POLICY "Group members can view shared product variants"
ON public.product_variants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id 
    AND p.group_id IS NOT NULL 
    AND is_group_member(p.group_id, auth.uid())
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing product data to variants
INSERT INTO public.product_variants (product_id, size, sku, stock_quantity)
SELECT id, COALESCE(size, 'Único'), sku, stock_quantity
FROM public.products
WHERE size IS NOT NULL OR stock_quantity > 0;