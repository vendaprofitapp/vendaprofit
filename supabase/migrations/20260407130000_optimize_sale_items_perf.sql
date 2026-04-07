-- 1. Add owner_id column
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 2. Populate existing records with owner_id from sales
UPDATE public.sale_items si
SET owner_id = s.owner_id
FROM public.sales s
WHERE si.sale_id = s.id
  AND si.owner_id IS NULL;

-- 3. Make owner_id NOT NULL and add Foreign Key constraint
-- Before making it NOT NULL, let's delete any orphaned sale_items that have no parent sale
DELETE FROM public.sale_items WHERE owner_id IS NULL;

ALTER TABLE public.sale_items ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE public.sale_items 
  ADD CONSTRAINT sale_items_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Create trigger to automatically assign owner_id based on sale_id
CREATE OR REPLACE FUNCTION public.set_sale_items_owner_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.sales WHERE id = NEW.sale_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_sale_items_owner_id ON public.sale_items;

CREATE TRIGGER trg_set_sale_items_owner_id
BEFORE INSERT ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.set_sale_items_owner_id();

-- 5. Add Indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_owner_id ON public.sale_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- 6. Replace RLS Policies
-- Drop old inefficient policies with EXISTS subqueries
DROP POLICY IF EXISTS "Users can view own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can insert own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can update own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can delete own sale items" ON public.sale_items;

-- Create fast O(1) policies using owner_id
CREATE POLICY "Users can view own sale items" 
  ON public.sale_items FOR SELECT 
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own sale items" 
  ON public.sale_items FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own sale items" 
  ON public.sale_items FOR UPDATE 
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own sale items" 
  ON public.sale_items FOR DELETE 
  USING (owner_id = auth.uid());
