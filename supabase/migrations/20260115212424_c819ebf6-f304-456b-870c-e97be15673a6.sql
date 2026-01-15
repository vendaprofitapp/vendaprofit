-- Fix orphan group references causing product creation failures

-- 1) Clean up invalid rows (orphan group_id)
DELETE FROM public.partnership_auto_share pas
WHERE NOT EXISTS (
  SELECT 1 FROM public.groups g WHERE g.id = pas.group_id
);

-- 2) Harden trigger function to only insert partnerships for valid groups
CREATE OR REPLACE FUNCTION public.auto_share_new_product_to_partnerships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.product_partnerships (group_id, product_id)
  SELECT pas.group_id, NEW.id
  FROM public.partnership_auto_share pas
  JOIN public.groups g ON g.id = pas.group_id
  WHERE pas.owner_id = NEW.owner_id
    AND pas.enabled = true
  ON CONFLICT (group_id, product_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) (Optional but recommended) Add FK so this can't happen again
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partnership_auto_share_group_id_fkey'
  ) THEN
    ALTER TABLE public.partnership_auto_share
      ADD CONSTRAINT partnership_auto_share_group_id_fkey
      FOREIGN KEY (group_id)
      REFERENCES public.groups(id)
      ON DELETE CASCADE;
  END IF;
END $$;