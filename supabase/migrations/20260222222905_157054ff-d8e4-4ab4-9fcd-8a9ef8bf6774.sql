
ALTER TABLE public.financial_splits DROP CONSTRAINT financial_splits_type_check;
ALTER TABLE public.financial_splits ADD CONSTRAINT financial_splits_type_check 
  CHECK (type = ANY (ARRAY['cost_recovery', 'profit_share', 'group_commission', 'payment_fee']));
