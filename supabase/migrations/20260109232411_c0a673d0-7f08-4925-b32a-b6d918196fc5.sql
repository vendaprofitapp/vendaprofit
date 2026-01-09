-- Create payment_fees table for storing fees per payment method
CREATE TABLE public.payment_fees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL,
    payment_method TEXT NOT NULL,
    fee_percent NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(owner_id, payment_method)
);

-- Enable RLS
ALTER TABLE public.payment_fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own payment fees"
ON public.payment_fees FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own payment fees"
ON public.payment_fees FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own payment fees"
ON public.payment_fees FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own payment fees"
ON public.payment_fees FOR DELETE
USING (owner_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_payment_fees_updated_at
BEFORE UPDATE ON public.payment_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fix groups RLS policy to allow searching by invite_code
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;

CREATE POLICY "Members can view their groups or search by invite code"
ON public.groups FOR SELECT
USING (
    (created_by = auth.uid()) 
    OR is_group_member(id, auth.uid())
    OR (invite_code IS NOT NULL)
);