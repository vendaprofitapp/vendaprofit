-- Create sales table (header)
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  customer_name TEXT,
  customer_phone TEXT,
  payment_method TEXT NOT NULL DEFAULT 'dinheiro',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed', -- 'fixed' or 'percentage'
  discount_value NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sale_items table (line items)
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales
CREATE POLICY "Users can view own sales" ON public.sales
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own sales" ON public.sales
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own sales" ON public.sales
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own sales" ON public.sales
  FOR DELETE USING (owner_id = auth.uid());

-- RLS policies for sale_items
CREATE POLICY "Users can view own sale items" ON public.sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own sale items" ON public.sale_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.owner_id = auth.uid())
  );

CREATE POLICY "Users can update own sale items" ON public.sale_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.owner_id = auth.uid())
  );

CREATE POLICY "Users can delete own sale items" ON public.sale_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.owner_id = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();