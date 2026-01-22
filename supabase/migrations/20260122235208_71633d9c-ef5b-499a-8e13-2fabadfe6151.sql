-- 1. Add due_date column to consortium_payments (already exists based on types, but ensuring it's there)
-- The column already exists based on types.ts

-- 2. Add new columns to consortium_participants
ALTER TABLE public.consortium_participants 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'replaced')),
ADD COLUMN IF NOT EXISTS current_balance numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_shipping_used boolean NOT NULL DEFAULT false;

-- 3. Create consortium_settings table for flexible configuration
CREATE TABLE IF NOT EXISTS public.consortium_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consortium_id uuid NOT NULL REFERENCES public.consortiums(id) ON DELETE CASCADE,
  grace_period_days integer NOT NULL DEFAULT 5,
  penalty_money_pct numeric(5,2) NOT NULL DEFAULT 10.00,
  penalty_product_pct numeric(5,2) NOT NULL DEFAULT 5.00,
  shipping_policy text NOT NULL DEFAULT 'first_free' CHECK (shipping_policy IN ('first_free', 'all_paid', 'all_free')),
  rebalance_mode text NOT NULL DEFAULT 'manual' CHECK (rebalance_mode IN ('manual', 'auto_distribute')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(consortium_id)
);

-- Enable RLS
ALTER TABLE public.consortium_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for consortium_settings
CREATE POLICY "Users can view settings for their consortiums"
ON public.consortium_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.consortiums c
    WHERE c.id = consortium_id AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can insert settings for their consortiums"
ON public.consortium_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.consortiums c
    WHERE c.id = consortium_id AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update settings for their consortiums"
ON public.consortium_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.consortiums c
    WHERE c.id = consortium_id AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete settings for their consortiums"
ON public.consortium_settings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.consortiums c
    WHERE c.id = consortium_id AND c.owner_id = auth.uid()
  )
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_consortium_settings_consortium_id ON public.consortium_settings(consortium_id);

-- Create trigger for updated_at
CREATE TRIGGER update_consortium_settings_updated_at
BEFORE UPDATE ON public.consortium_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create function to rebalance installments when a participant withdraws
CREATE OR REPLACE FUNCTION public.rebalance_consortium_installments(
  _consortium_id uuid,
  _withdrawn_participant_id uuid,
  _remaining_unpaid numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _active_participants integer;
  _per_participant_increase numeric;
BEGIN
  -- Count active participants excluding the withdrawn one
  SELECT COUNT(*) INTO _active_participants
  FROM consortium_participants
  WHERE consortium_id = _consortium_id
    AND id != _withdrawn_participant_id
    AND status = 'active';
  
  IF _active_participants = 0 THEN
    RAISE EXCEPTION 'No active participants to rebalance';
  END IF;
  
  -- Calculate increase per participant
  _per_participant_increase := _remaining_unpaid / _active_participants;
  
  -- Distribute the remaining amount across unpaid installments of active participants
  UPDATE consortium_payments cp
  SET amount = amount + (_per_participant_increase / (
    SELECT COUNT(*) FROM consortium_payments cp2
    WHERE cp2.participant_id = cp.participant_id
      AND cp2.is_paid = false
  ))
  FROM consortium_participants p
  WHERE cp.participant_id = p.id
    AND p.consortium_id = _consortium_id
    AND p.id != _withdrawn_participant_id
    AND p.status = 'active'
    AND cp.is_paid = false;
END;
$$;

-- 5. Create function to process participant withdrawal
CREATE OR REPLACE FUNCTION public.process_consortium_withdrawal(
  _participant_id uuid,
  _withdrawal_type text, -- 'money' or 'product'
  _penalty_pct numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _participant RECORD;
  _total_paid numeric;
  _penalty_amount numeric;
  _final_balance numeric;
  _result jsonb;
BEGIN
  -- Get participant info
  SELECT p.*, c.total_value, c.installments_count, c.id as consortium_id
  INTO _participant
  FROM consortium_participants p
  JOIN consortiums c ON c.id = p.consortium_id
  WHERE p.id = _participant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Participant not found');
  END IF;
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO _total_paid
  FROM consortium_payments
  WHERE participant_id = _participant_id AND is_paid = true;
  
  -- Calculate penalty
  _penalty_amount := _total_paid * (_penalty_pct / 100);
  _final_balance := _total_paid - _penalty_amount;
  
  -- Update participant status and balance
  UPDATE consortium_participants
  SET status = 'withdrawn',
      current_balance = CASE WHEN _withdrawal_type = 'product' THEN _final_balance ELSE 0 END,
      updated_at = now()
  WHERE id = _participant_id;
  
  _result := jsonb_build_object(
    'success', true,
    'total_paid', _total_paid,
    'penalty_amount', _penalty_amount,
    'final_balance', _final_balance,
    'withdrawal_type', _withdrawal_type
  );
  
  RETURN _result;
END;
$$;