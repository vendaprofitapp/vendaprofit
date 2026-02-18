
ALTER TABLE partner_points
  ADD COLUMN IF NOT EXISTS contract_token text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contract_accepted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contract_accepted_ip text DEFAULT NULL;

-- Allow public (unauthenticated) to read partner_points by contract_token
-- The existing "Public can view partner points by access token" policy uses is_active = true
-- so the public contract page can already fetch the partner.
-- We need to allow public UPDATE for accepting the contract (done via edge function with service role).
