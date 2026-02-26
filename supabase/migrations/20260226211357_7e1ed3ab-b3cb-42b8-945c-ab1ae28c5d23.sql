-- PASSO 2: Partial Unique Index + status 'archived'
-- Drop existing unique constraints if any on (owner_id, seller_id) or (owner_id, invited_email)
DO $$
BEGIN
  -- Drop unique index on owner_id + seller_id if exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'hub_connections' AND indexname = 'hub_connections_owner_id_seller_id_key'
  ) THEN
    DROP INDEX hub_connections_owner_id_seller_id_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'hub_connections' AND indexname = 'hub_connections_owner_id_invited_email_key'
  ) THEN
    DROP INDEX hub_connections_owner_id_invited_email_key;
  END IF;
END $$;

-- Create partial unique indexes that only apply when status is active or pending
CREATE UNIQUE INDEX IF NOT EXISTS hub_connections_active_owner_seller_unique
  ON public.hub_connections (owner_id, seller_id)
  WHERE status IN ('active', 'pending') AND seller_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hub_connections_active_owner_email_unique
  ON public.hub_connections (owner_id, invited_email)
  WHERE status IN ('active', 'pending');
