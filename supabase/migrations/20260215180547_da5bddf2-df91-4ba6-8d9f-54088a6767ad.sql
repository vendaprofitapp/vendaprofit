
-- 1. Create loyalty_levels table
CREATE TABLE public.loyalty_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  min_spent numeric NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#8B5CF6',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own loyalty levels"
  ON public.loyalty_levels FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own loyalty levels"
  ON public.loyalty_levels FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own loyalty levels"
  ON public.loyalty_levels FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own loyalty levels"
  ON public.loyalty_levels FOR DELETE
  USING (owner_id = auth.uid());

-- 2. Add total_spent column to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0;

-- 3. Function to get customer loyalty level
CREATE OR REPLACE FUNCTION public.get_customer_loyalty_level(_customer_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'name', ll.name,
        'color', ll.color,
        'features', ll.features
      )
      FROM loyalty_levels ll
      JOIN customers c ON c.owner_id = ll.owner_id
      WHERE c.id = _customer_id
        AND ll.min_spent <= c.total_spent
      ORDER BY ll.min_spent DESC
      LIMIT 1
    ),
    '{"name": "Sem nível", "color": "#9CA3AF", "features": []}'::jsonb
  )
$$;

-- 4. Trigger function to accumulate spending on INSERT
CREATE OR REPLACE FUNCTION public.accumulate_customer_spending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only for completed sales with a customer phone
  IF NEW.status = 'completed' AND NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
    UPDATE customers
    SET total_spent = total_spent + NEW.total
    WHERE owner_id = NEW.owner_id
      AND phone = NEW.customer_phone;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Trigger function for UPDATE on sales
CREATE OR REPLACE FUNCTION public.adjust_customer_spending_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If old was completed, subtract old total
  IF OLD.status = 'completed' AND OLD.customer_phone IS NOT NULL AND OLD.customer_phone != '' THEN
    UPDATE customers
    SET total_spent = GREATEST(total_spent - OLD.total, 0)
    WHERE owner_id = OLD.owner_id
      AND phone = OLD.customer_phone;
  END IF;

  -- If new is completed, add new total
  IF NEW.status = 'completed' AND NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
    UPDATE customers
    SET total_spent = total_spent + NEW.total
    WHERE owner_id = NEW.owner_id
      AND phone = NEW.customer_phone;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Trigger function for DELETE on sales
CREATE OR REPLACE FUNCTION public.adjust_customer_spending_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' AND OLD.customer_phone IS NOT NULL AND OLD.customer_phone != '' THEN
    UPDATE customers
    SET total_spent = GREATEST(total_spent - OLD.total, 0)
    WHERE owner_id = OLD.owner_id
      AND phone = OLD.customer_phone;
  END IF;
  RETURN OLD;
END;
$$;

-- 7. Attach triggers to sales table
CREATE TRIGGER trg_accumulate_spending_insert
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.accumulate_customer_spending();

CREATE TRIGGER trg_adjust_spending_update
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_customer_spending_on_update();

CREATE TRIGGER trg_adjust_spending_delete
  AFTER DELETE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_customer_spending_on_delete();
