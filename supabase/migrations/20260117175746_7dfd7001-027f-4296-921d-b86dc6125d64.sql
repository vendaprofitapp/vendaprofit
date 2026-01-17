-- Ensure commission_percent is required (it already is, but let's make sure)
-- Add partnership split configuration fields to groups table

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS cost_split_ratio numeric NOT NULL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS profit_share_seller numeric NOT NULL DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS profit_share_partner numeric NOT NULL DEFAULT 0.3;

-- Add comments to document the fields
COMMENT ON COLUMN public.groups.cost_split_ratio IS 'Ratio of cost split between seller and owner (0.5 = 50% each)';
COMMENT ON COLUMN public.groups.profit_share_seller IS 'Seller profit share ratio (0.7 = 70% of profit)';
COMMENT ON COLUMN public.groups.profit_share_partner IS 'Partner/owner profit share ratio (0.3 = 30% of profit)';