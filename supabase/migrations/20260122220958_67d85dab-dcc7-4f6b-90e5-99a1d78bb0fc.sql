-- Create customer_orders table for backorder management
CREATE TABLE public.customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  supplier_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  status text NOT NULL DEFAULT 'pending'
);

-- Add constraint for valid status values
ALTER TABLE public.customer_orders 
ADD CONSTRAINT customer_orders_status_check 
CHECK (status IN ('pending', 'ordered', 'arrived', 'delivered', 'cancelled'));

-- Enable RLS
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is direct partner
CREATE OR REPLACE FUNCTION public.is_direct_partner(_user_id uuid, _partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    JOIN groups g ON g.id = gm1.group_id
    WHERE g.is_direct = true
      AND gm1.user_id = _user_id
      AND gm2.user_id = _partner_id
      AND gm1.user_id != gm2.user_id
  )
$$;

-- RLS Policy: Users can view their own orders OR orders from direct partners
CREATE POLICY "Users can view own and partner orders"
ON public.customer_orders
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_direct_partner(auth.uid(), user_id)
);

-- RLS Policy: Users can insert their own orders
CREATE POLICY "Users can insert own orders"
ON public.customer_orders
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own orders
CREATE POLICY "Users can update own orders"
ON public.customer_orders
FOR UPDATE
USING (user_id = auth.uid());

-- RLS Policy: Users can delete their own orders
CREATE POLICY "Users can delete own orders"
ON public.customer_orders
FOR DELETE
USING (user_id = auth.uid());

-- Create index for common queries
CREATE INDEX idx_customer_orders_user_id ON public.customer_orders(user_id);
CREATE INDEX idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX idx_customer_orders_supplier ON public.customer_orders(supplier_name);

-- Trigger for updated_at
CREATE TRIGGER update_customer_orders_updated_at
BEFORE UPDATE ON public.customer_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();