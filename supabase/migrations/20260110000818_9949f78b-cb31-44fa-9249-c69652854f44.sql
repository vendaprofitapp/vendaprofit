-- Fix infinite recursion caused by RLS + helper functions on group_members
-- Make membership helper functions bypass RLS safely
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.user_id = _user_id
      AND gm.role IN ('owner', 'admin')
  );
$$;

-- Ensure product partnerships are unique per (group, product)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'product_partnerships_group_product_key'
  ) THEN
    CREATE UNIQUE INDEX product_partnerships_group_product_key
      ON public.product_partnerships (group_id, product_id);
  END IF;
END $$;

-- Auto-share settings: allow "share all current + future" per partnership
CREATE TABLE IF NOT EXISTS public.partnership_auto_share (
  group_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, owner_id)
);

ALTER TABLE public.partnership_auto_share ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='partnership_auto_share' AND policyname='Users can view own auto share'
  ) THEN
    CREATE POLICY "Users can view own auto share"
    ON public.partnership_auto_share
    FOR SELECT
    USING (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='partnership_auto_share' AND policyname='Users can upsert own auto share'
  ) THEN
    CREATE POLICY "Users can upsert own auto share"
    ON public.partnership_auto_share
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='partnership_auto_share' AND policyname='Users can update own auto share'
  ) THEN
    CREATE POLICY "Users can update own auto share"
    ON public.partnership_auto_share
    FOR UPDATE
    USING (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='partnership_auto_share' AND policyname='Users can delete own auto share'
  ) THEN
    CREATE POLICY "Users can delete own auto share"
    ON public.partnership_auto_share
    FOR DELETE
    USING (auth.uid() = owner_id);
  END IF;
END $$;

-- Updated_at trigger helper (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_partnership_auto_share_updated_at ON public.partnership_auto_share;
CREATE TRIGGER update_partnership_auto_share_updated_at
BEFORE UPDATE ON public.partnership_auto_share
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to enable/disable auto-share (also backfills/removes existing products)
CREATE OR REPLACE FUNCTION public.set_partnership_auto_share(_group_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.partnership_auto_share (group_id, owner_id, enabled)
  VALUES (_group_id, _uid, _enabled)
  ON CONFLICT (group_id, owner_id)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

  IF _enabled THEN
    INSERT INTO public.product_partnerships (group_id, product_id)
    SELECT _group_id, p.id
    FROM public.products p
    WHERE p.owner_id = _uid
      AND p.is_active = true
    ON CONFLICT (group_id, product_id) DO NOTHING;
  ELSE
    DELETE FROM public.product_partnerships pp
    USING public.products p
    WHERE pp.group_id = _group_id
      AND pp.product_id = p.id
      AND p.owner_id = _uid;
  END IF;
END;
$$;

-- Trigger: when a new product is created, auto-share it to enabled partnerships
CREATE OR REPLACE FUNCTION public.auto_share_new_product_to_partnerships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_partnerships (group_id, product_id)
  SELECT pas.group_id, NEW.id
  FROM public.partnership_auto_share pas
  WHERE pas.owner_id = NEW.owner_id
    AND pas.enabled = true
  ON CONFLICT (group_id, product_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_share_new_product_to_partnerships ON public.products;
CREATE TRIGGER trg_auto_share_new_product_to_partnerships
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.auto_share_new_product_to_partnerships();
