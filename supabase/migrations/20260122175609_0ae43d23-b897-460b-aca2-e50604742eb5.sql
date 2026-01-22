
-- Create consignments table
CREATE TABLE public.consignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'active', 'finalized_by_client', 'completed', 'cancelled')),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  deadline_at timestamp with time zone,
  shipping_cost numeric DEFAULT 0,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create consignment_items table
CREATE TABLE public.consignment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consignment_id uuid NOT NULL REFERENCES public.consignments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  variant_id uuid REFERENCES public.product_variants(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'kept', 'returned')),
  original_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create product_waitlist table
CREATE TABLE public.product_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id),
  customer_id uuid REFERENCES public.customers(id),
  customer_phone text,
  customer_name text,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'converted', 'cancelled')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consignments
CREATE POLICY "Public can view consignments by access token"
ON public.consignments FOR SELECT
USING (true);

CREATE POLICY "Users can insert own consignments"
ON public.consignments FOR INSERT
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Users can update own consignments"
ON public.consignments FOR UPDATE
USING (seller_id = auth.uid());

CREATE POLICY "Users can delete own consignments"
ON public.consignments FOR DELETE
USING (seller_id = auth.uid());

-- RLS Policies for consignment_items
CREATE POLICY "Public can view consignment items"
ON public.consignment_items FOR SELECT
USING (true);

CREATE POLICY "Users can insert consignment items for own consignments"
ON public.consignment_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.consignments c
  WHERE c.id = consignment_id AND c.seller_id = auth.uid()
));

CREATE POLICY "Users can update consignment items for own consignments"
ON public.consignment_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.consignments c
  WHERE c.id = consignment_id AND c.seller_id = auth.uid()
));

CREATE POLICY "Public can update consignment items by access token"
ON public.consignment_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.consignments c
  WHERE c.id = consignment_id AND c.status IN ('active', 'awaiting_approval')
));

CREATE POLICY "Users can delete consignment items for own consignments"
ON public.consignment_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.consignments c
  WHERE c.id = consignment_id AND c.seller_id = auth.uid()
));

-- RLS Policies for product_waitlist
CREATE POLICY "Users can view own waitlist entries"
ON public.product_waitlist FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_id AND p.owner_id = auth.uid()
));

CREATE POLICY "Users can insert waitlist entries for own products"
ON public.product_waitlist FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_id AND p.owner_id = auth.uid()
));

CREATE POLICY "Users can update waitlist entries for own products"
ON public.product_waitlist FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_id AND p.owner_id = auth.uid()
));

CREATE POLICY "Users can delete waitlist entries for own products"
ON public.product_waitlist FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_id AND p.owner_id = auth.uid()
));

-- Create indexes for better performance
CREATE INDEX idx_consignments_seller_id ON public.consignments(seller_id);
CREATE INDEX idx_consignments_customer_id ON public.consignments(customer_id);
CREATE INDEX idx_consignments_access_token ON public.consignments(access_token);
CREATE INDEX idx_consignments_status ON public.consignments(status);
CREATE INDEX idx_consignment_items_consignment_id ON public.consignment_items(consignment_id);
CREATE INDEX idx_consignment_items_product_id ON public.consignment_items(product_id);
CREATE INDEX idx_product_waitlist_product_id ON public.product_waitlist(product_id);
CREATE INDEX idx_product_waitlist_customer_id ON public.product_waitlist(customer_id);

-- Create triggers for updated_at
CREATE TRIGGER update_consignments_updated_at
BEFORE UPDATE ON public.consignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consignment_items_updated_at
BEFORE UPDATE ON public.consignment_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_waitlist_updated_at
BEFORE UPDATE ON public.product_waitlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
