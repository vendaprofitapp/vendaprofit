
-- HUB DE VENDAS: Tabelas completamente novas, sem reutilizar nada do sistema atual

-- 1. Conexões entre Dono e Vendedor
CREATE TABLE public.hub_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  seller_id UUID,
  invited_email TEXT NOT NULL,
  commission_pct NUMERIC NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  invite_code TEXT NOT NULL DEFAULT substring(md5(random()::text), 1, 12),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (invite_code)
);

ALTER TABLE public.hub_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_connections_owner_all" ON public.hub_connections
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "hub_connections_seller_read" ON public.hub_connections
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "hub_connections_seller_update" ON public.hub_connections
  FOR UPDATE USING (auth.uid() = seller_id);

-- 2. Produtos compartilhados no HUB
CREATE TABLE public.hub_shared_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.hub_connections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (connection_id, product_id)
);

ALTER TABLE public.hub_shared_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_shared_products_owner_all" ON public.hub_shared_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hub_connections hc
      WHERE hc.id = hub_shared_products.connection_id
        AND hc.owner_id = auth.uid()
    )
  );

CREATE POLICY "hub_shared_products_seller_read" ON public.hub_shared_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hub_connections hc
      WHERE hc.id = hub_shared_products.connection_id
        AND hc.seller_id = auth.uid()
        AND hc.status = 'active'
    )
  );

-- 3. Splits financeiros das vendas do HUB
CREATE TABLE public.hub_sale_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.hub_connections(id),
  owner_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  commission_pct NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  shipping_amount NUMERIC NOT NULL DEFAULT 0,
  owner_amount NUMERIC NOT NULL DEFAULT 0,
  seller_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_sale_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_sale_splits_owner_all" ON public.hub_sale_splits
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "hub_sale_splits_seller_read" ON public.hub_sale_splits
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "hub_sale_splits_seller_insert" ON public.hub_sale_splits
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- Trigger para updated_at em hub_connections
CREATE TRIGGER update_hub_connections_updated_at
  BEFORE UPDATE ON public.hub_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
