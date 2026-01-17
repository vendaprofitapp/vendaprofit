-- 1. Add commission_percent to groups table
ALTER TABLE public.groups 
ADD COLUMN commission_percent numeric NOT NULL DEFAULT 0.20;

-- Add comment for documentation
COMMENT ON COLUMN public.groups.commission_percent IS 'Percentage of profit the product owner earns (L.E.V.E. logic)';

-- 2. Create financial_splits table for tracking profit distribution
CREATE TABLE public.financial_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('cost_recovery', 'profit_share', 'group_commission')),
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_financial_splits_sale_id ON public.financial_splits(sale_id);
CREATE INDEX idx_financial_splits_user_id ON public.financial_splits(user_id);
CREATE INDEX idx_financial_splits_type ON public.financial_splits(type);

-- Enable RLS
ALTER TABLE public.financial_splits ENABLE ROW LEVEL SECURITY;

-- RLS policies for financial_splits
CREATE POLICY "Users can view their own financial splits"
ON public.financial_splits
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view splits for their sales"
ON public.financial_splits
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = financial_splits.sale_id AND s.owner_id = auth.uid()
));

CREATE POLICY "Users can insert splits for their sales"
ON public.financial_splits
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = financial_splits.sale_id AND s.owner_id = auth.uid()
));

CREATE POLICY "Users can delete splits for their sales"
ON public.financial_splits
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = financial_splits.sale_id AND s.owner_id = auth.uid()
));

-- 3. Add sale_source to sales table
ALTER TABLE public.sales
ADD COLUMN sale_source text NOT NULL DEFAULT 'estoque_proprio' 
CHECK (sale_source IN ('estoque_proprio', 'estoque_parceria', 'estoque_grupo'));

-- Add comment for documentation
COMMENT ON COLUMN public.sales.sale_source IS 'Source of inventory: estoque_proprio, estoque_parceria, estoque_grupo';