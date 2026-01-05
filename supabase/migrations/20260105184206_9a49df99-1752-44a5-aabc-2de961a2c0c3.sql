-- Create partnership_rules table to store custom rules per group
CREATE TABLE public.partnership_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  seller_cost_percent NUMERIC NOT NULL DEFAULT 50,
  seller_profit_percent NUMERIC NOT NULL DEFAULT 70,
  owner_cost_percent NUMERIC NOT NULL DEFAULT 50,
  owner_profit_percent NUMERIC NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id)
);

-- Create product_partnerships table to link products to multiple partnerships
CREATE TABLE public.product_partnerships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, group_id)
);

-- Enable RLS
ALTER TABLE public.partnership_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_partnerships ENABLE ROW LEVEL SECURITY;

-- RLS policies for partnership_rules
CREATE POLICY "Group members can view partnership rules"
ON public.partnership_rules
FOR SELECT
USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "Group admins can insert partnership rules"
ON public.partnership_rules
FOR INSERT
WITH CHECK (is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can update partnership rules"
ON public.partnership_rules
FOR UPDATE
USING (is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can delete partnership rules"
ON public.partnership_rules
FOR DELETE
USING (is_group_admin(group_id, auth.uid()));

-- RLS policies for product_partnerships
CREATE POLICY "Group members can view product partnerships"
ON public.product_partnerships
FOR SELECT
USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "Product owners can insert product partnerships"
ON public.product_partnerships
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id AND p.owner_id = auth.uid()
  )
  AND is_group_member(group_id, auth.uid())
);

CREATE POLICY "Product owners can delete product partnerships"
ON public.product_partnerships
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id AND p.owner_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_partnership_rules_updated_at
BEFORE UPDATE ON public.partnership_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();