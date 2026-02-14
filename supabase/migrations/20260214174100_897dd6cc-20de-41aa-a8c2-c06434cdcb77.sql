
-- Tabela de leads capturados na loja pública
CREATE TABLE public.store_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  whatsapp text NOT NULL,
  device_id text,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_store_leads_owner ON public.store_leads(owner_id);
CREATE INDEX idx_store_leads_store ON public.store_leads(store_id);
CREATE UNIQUE INDEX idx_store_leads_device_store ON public.store_leads(store_id, device_id) WHERE device_id IS NOT NULL;

-- RLS
ALTER TABLE public.store_leads ENABLE ROW LEVEL SECURITY;

-- Owner pode ver/editar/deletar seus leads
CREATE POLICY "Owners can view their leads"
  ON public.store_leads FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can update their leads"
  ON public.store_leads FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their leads"
  ON public.store_leads FOR DELETE
  USING (owner_id = auth.uid());

-- Visitantes anônimos podem inserir leads (público)
CREATE POLICY "Public can insert leads"
  ON public.store_leads FOR INSERT
  WITH CHECK (true);

-- Tabela de itens do carrinho abandonado
CREATE TABLE public.lead_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.store_leads(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  variant_color text,
  selected_size text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'abandoned',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_cart_items_lead ON public.lead_cart_items(lead_id);
CREATE INDEX idx_lead_cart_items_status ON public.lead_cart_items(status);

-- RLS
ALTER TABLE public.lead_cart_items ENABLE ROW LEVEL SECURITY;

-- Owner pode ver/editar/deletar via join com store_leads
CREATE POLICY "Owners can view lead cart items"
  ON public.lead_cart_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.store_leads sl
    WHERE sl.id = lead_cart_items.lead_id AND sl.owner_id = auth.uid()
  ));

CREATE POLICY "Owners can update lead cart items"
  ON public.lead_cart_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.store_leads sl
    WHERE sl.id = lead_cart_items.lead_id AND sl.owner_id = auth.uid()
  ));

CREATE POLICY "Owners can delete lead cart items"
  ON public.lead_cart_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.store_leads sl
    WHERE sl.id = lead_cart_items.lead_id AND sl.owner_id = auth.uid()
  ));

-- Visitantes anônimos podem inserir itens de carrinho
CREATE POLICY "Public can insert lead cart items"
  ON public.lead_cart_items FOR INSERT
  WITH CHECK (true);
