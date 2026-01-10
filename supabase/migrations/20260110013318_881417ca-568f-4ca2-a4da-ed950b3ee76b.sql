-- Create custom payment methods table
CREATE TABLE public.custom_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_deferred BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own payment methods"
ON public.custom_payment_methods FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own payment methods"
ON public.custom_payment_methods FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own payment methods"
ON public.custom_payment_methods FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own payment methods"
ON public.custom_payment_methods FOR DELETE
USING (auth.uid() = owner_id);

-- Create payment reminders table for deferred payments
CREATE TABLE public.payment_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_instagram TEXT,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_method_name TEXT NOT NULL,
  notes TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own payment reminders"
ON public.payment_reminders FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own payment reminders"
ON public.payment_reminders FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own payment reminders"
ON public.payment_reminders FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own payment reminders"
ON public.payment_reminders FOR DELETE
USING (auth.uid() = owner_id);

-- Triggers for updated_at
CREATE TRIGGER update_custom_payment_methods_updated_at
BEFORE UPDATE ON public.custom_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_reminders_updated_at
BEFORE UPDATE ON public.payment_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();