
-- Add payment routing fields to partner_points
ALTER TABLE partner_points
  ADD COLUMN IF NOT EXISTS payment_receiver text NOT NULL DEFAULT 'partner',
  ADD COLUMN IF NOT EXISTS allowed_payment_methods jsonb DEFAULT '[]'::jsonb;

-- Add per-sale fee tracking to partner_point_sales
ALTER TABLE partner_point_sales
  ADD COLUMN IF NOT EXISTS payment_fee_applied numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_payment_method_id text DEFAULT NULL;
