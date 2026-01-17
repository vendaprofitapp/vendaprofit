-- Add partnership configuration columns to direct_partnership_invites
ALTER TABLE public.direct_partnership_invites
ADD COLUMN IF NOT EXISTS cost_split_ratio numeric DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS profit_share_seller numeric DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS profit_share_partner numeric DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS owner_commission_percent numeric DEFAULT 0.2;

-- Add comments to document the fields
COMMENT ON COLUMN public.direct_partnership_invites.cost_split_ratio IS 'Ratio of cost split between partners (0.5 = 50/50)';
COMMENT ON COLUMN public.direct_partnership_invites.profit_share_seller IS 'Seller profit share ratio (0.7 = 70%)';
COMMENT ON COLUMN public.direct_partnership_invites.profit_share_partner IS 'Partner/owner profit share ratio (0.3 = 30%)';
COMMENT ON COLUMN public.direct_partnership_invites.owner_commission_percent IS 'Commission percentage for the product owner (0.2 = 20%)';