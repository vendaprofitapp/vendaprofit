
-- ============================================================
-- FASE 1: Tabelas partner_points e partner_point_items
-- Totalmente aditivas — nenhuma tabela existente é modificada
-- ============================================================

-- Tabela: partner_points (cadastro dos locais parceiros)
CREATE TABLE public.partner_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  address TEXT,
  rack_commission_pct NUMERIC NOT NULL DEFAULT 0,
  pickup_commission_pct NUMERIC NOT NULL DEFAULT 0,
  payment_fee_pct NUMERIC NOT NULL DEFAULT 0,
  loss_risk_enabled BOOLEAN NOT NULL DEFAULT false,
  replenishment_cycle_days INTEGER DEFAULT 30,
  min_stock_alert INTEGER DEFAULT 3,
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: partner_point_items (etiqueta de localização de cada peça)
CREATE TABLE public.partner_point_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_point_id UUID NOT NULL REFERENCES public.partner_points(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  variant_id UUID,
  owner_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'allocated'
    CHECK (status IN ('allocated','sold_online','sold_at_location','sold_pickup','returning','returned','lost')),
  allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  returned_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- FASE 2: Tabela partner_point_sales (vendas no ponto)
-- ============================================================

CREATE TABLE public.partner_point_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_point_id UUID NOT NULL REFERENCES public.partner_points(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_gross NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'pix'
    CHECK (payment_method IN ('pix','card','try_home','infinite_shelf')),
  pass_color TEXT NOT NULL DEFAULT 'green'
    CHECK (pass_color IN ('green','yellow','blue','purple')),
  pass_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (pass_status IN ('pending','validated','completed','returned')),
  payment_proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_partner_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_partner_points_updated_at
  BEFORE UPDATE ON public.partner_points
  FOR EACH ROW EXECUTE FUNCTION public.update_partner_points_updated_at();

CREATE TRIGGER update_partner_point_items_updated_at
  BEFORE UPDATE ON public.partner_point_items
  FOR EACH ROW EXECUTE FUNCTION public.update_partner_points_updated_at();

CREATE TRIGGER update_partner_point_sales_updated_at
  BEFORE UPDATE ON public.partner_point_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_partner_points_updated_at();

-- ============================================================
-- RLS: Row Level Security
-- ============================================================

ALTER TABLE public.partner_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_point_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_point_sales ENABLE ROW LEVEL SECURITY;

-- partner_points: CRUD restrito ao owner
CREATE POLICY "Users can view own partner points"
  ON public.partner_points FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Public can view partner points by access token"
  ON public.partner_points FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can insert own partner points"
  ON public.partner_points FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own partner points"
  ON public.partner_points FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own partner points"
  ON public.partner_points FOR DELETE
  USING (owner_id = auth.uid());

-- partner_point_items: CRUD restrito ao owner
CREATE POLICY "Users can view own partner point items"
  ON public.partner_point_items FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Public can view allocated items by partner point"
  ON public.partner_point_items FOR SELECT
  USING (status = 'allocated');

CREATE POLICY "Users can insert own partner point items"
  ON public.partner_point_items FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own partner point items"
  ON public.partner_point_items FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own partner point items"
  ON public.partner_point_items FOR DELETE
  USING (owner_id = auth.uid());

-- partner_point_sales: owner CRUD + public insert (catálogo QR)
CREATE POLICY "Users can view own partner point sales"
  ON public.partner_point_sales FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Public can insert partner point sales"
  ON public.partner_point_sales FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own partner point sales"
  ON public.partner_point_sales FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own partner point sales"
  ON public.partner_point_sales FOR DELETE
  USING (owner_id = auth.uid());
