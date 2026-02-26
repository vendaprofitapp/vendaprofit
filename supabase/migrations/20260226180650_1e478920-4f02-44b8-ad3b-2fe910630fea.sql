
-- Hub Pending Orders: Cross-docking workflow
CREATE TABLE public.hub_pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.hub_connections(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  payment_method text DEFAULT 'Dinheiro',
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'pending_hub_approval',
  -- logistics info (set by seller after approval)
  shipping_label_url text,
  collection_instructions text,
  logistics_set_at timestamptz,
  -- finalization
  sale_id uuid, -- populated when finalized
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_pending_orders_status_check CHECK (
    status IN ('pending_hub_approval', 'partially_approved', 'awaiting_logistics', 'logistics_ready', 'completed', 'cancelled')
  )
);

CREATE TABLE public.hub_pending_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.hub_pending_orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid,
  variant_id uuid,
  product_name text NOT NULL,
  variant_size text,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  hub_connection_id uuid REFERENCES public.hub_connections(id),
  hub_commission_pct numeric NOT NULL DEFAULT 0,
  hub_owner_id uuid NOT NULL,
  -- owner decision
  status text NOT NULL DEFAULT 'pending',
  estimated_dispatch_date date,
  rejection_reason text,
  owner_responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_pending_order_items_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'removed')
  )
);

-- Storage bucket for shipping labels
INSERT INTO storage.buckets (id, name, public) VALUES ('hub-shipping-labels', 'hub-shipping-labels', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload shipping labels"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hub-shipping-labels');

CREATE POLICY "Shipping labels are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'hub-shipping-labels');

-- RLS
ALTER TABLE public.hub_pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_pending_order_items ENABLE ROW LEVEL SECURITY;

-- Sellers can see their own pending orders
CREATE POLICY "Sellers can view their hub pending orders"
ON public.hub_pending_orders FOR SELECT
USING (seller_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "Sellers can insert hub pending orders"
ON public.hub_pending_orders FOR INSERT
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers and owners can update hub pending orders"
ON public.hub_pending_orders FOR UPDATE
USING (seller_id = auth.uid() OR owner_id = auth.uid());

-- Items policies
CREATE POLICY "Sellers and owners can view order items"
ON public.hub_pending_order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hub_pending_orders hpo
    WHERE hpo.id = hub_pending_order_items.order_id
      AND (hpo.seller_id = auth.uid() OR hpo.owner_id = auth.uid())
  )
);

CREATE POLICY "Sellers can insert order items"
ON public.hub_pending_order_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hub_pending_orders hpo
    WHERE hpo.id = hub_pending_order_items.order_id
      AND hpo.seller_id = auth.uid()
  )
);

CREATE POLICY "Sellers and owners can update order items"
ON public.hub_pending_order_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hub_pending_orders hpo
    WHERE hpo.id = hub_pending_order_items.order_id
      AND (hpo.seller_id = auth.uid() OR hpo.owner_id = auth.uid())
  )
);

-- updated_at trigger
CREATE TRIGGER update_hub_pending_orders_updated_at
BEFORE UPDATE ON public.hub_pending_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications table for hub order events
CREATE TABLE public.hub_order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  order_id uuid REFERENCES public.hub_pending_orders(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'new_order', 'item_approved', 'item_rejected', 'logistics_ready', 'order_finalized'
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_order_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hub notifications"
ON public.hub_order_notifications FOR SELECT
USING (recipient_id = auth.uid());

CREATE POLICY "System can insert hub notifications"
ON public.hub_order_notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own hub notifications"
ON public.hub_order_notifications FOR UPDATE
USING (recipient_id = auth.uid());
