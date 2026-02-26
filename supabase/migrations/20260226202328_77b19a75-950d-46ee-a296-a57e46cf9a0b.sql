
ALTER TABLE public.saved_cart_items
  ADD COLUMN IF NOT EXISTS hub_connection_id uuid REFERENCES public.hub_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hub_owner_id uuid,
  ADD COLUMN IF NOT EXISTS hub_commission_pct numeric DEFAULT 0;
