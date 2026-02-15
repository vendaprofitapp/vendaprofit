
-- Tabela de carrinhos salvos
CREATE TABLE public.saved_carts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_code text NOT NULL UNIQUE,
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  lead_id uuid REFERENCES public.store_leads(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de itens do carrinho salvo
CREATE TABLE public.saved_cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id uuid NOT NULL REFERENCES public.saved_carts(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  variant_color text,
  selected_size text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  source text DEFAULT 'local'
);

-- Coluna source em lead_cart_items
ALTER TABLE public.lead_cart_items ADD COLUMN IF NOT EXISTS source text;

-- RLS para saved_carts
ALTER TABLE public.saved_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their saved carts"
  ON public.saved_carts FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can update their saved carts"
  ON public.saved_carts FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their saved carts"
  ON public.saved_carts FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "Public can insert saved carts"
  ON public.saved_carts FOR INSERT
  WITH CHECK (true);

-- RLS para saved_cart_items
ALTER TABLE public.saved_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their saved cart items"
  ON public.saved_cart_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.saved_carts sc WHERE sc.id = saved_cart_items.cart_id AND sc.owner_id = auth.uid()
  ));

CREATE POLICY "Public can insert saved cart items"
  ON public.saved_cart_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can update their saved cart items"
  ON public.saved_cart_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.saved_carts sc WHERE sc.id = saved_cart_items.cart_id AND sc.owner_id = auth.uid()
  ));

CREATE POLICY "Owners can delete their saved cart items"
  ON public.saved_cart_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.saved_carts sc WHERE sc.id = saved_cart_items.cart_id AND sc.owner_id = auth.uid()
  ));

-- Trigger para updated_at em saved_carts
CREATE TRIGGER update_saved_carts_updated_at
  BEFORE UPDATE ON public.saved_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Permitir leitura pública de saved_carts pelo short_code (para catálogo buscar)
CREATE POLICY "Public can read saved carts by short code"
  ON public.saved_carts FOR SELECT
  USING (true);
