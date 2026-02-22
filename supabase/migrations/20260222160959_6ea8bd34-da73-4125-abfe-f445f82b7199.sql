
-- Tabela de permissões individuais do Bazar por cliente
CREATE TABLE public.customer_bazar_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  can_sell BOOLEAN NOT NULL DEFAULT false,
  can_buy BOOLEAN NOT NULL DEFAULT false,
  bazar_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, owner_id)
);

-- RLS
ALTER TABLE public.customer_bazar_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their customer bazar permissions"
  ON public.customer_bazar_permissions
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Public read by token (for public bazar seller page)
CREATE POLICY "Public can read by bazar_token"
  ON public.customer_bazar_permissions
  FOR SELECT
  USING (true);

-- Updated at trigger
CREATE TRIGGER update_customer_bazar_permissions_updated_at
  BEFORE UPDATE ON public.customer_bazar_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_customer_bazar_permissions_owner ON public.customer_bazar_permissions(owner_id);
CREATE INDEX idx_customer_bazar_permissions_token ON public.customer_bazar_permissions(bazar_token);
