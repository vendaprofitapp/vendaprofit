-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own customers" 
ON public.customers FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own customers" 
ON public.customers FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own customers" 
ON public.customers FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own customers" 
ON public.customers FOR DELETE 
USING (owner_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for customer photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-photos', 'customer-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view customer photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'customer-photos');

CREATE POLICY "Authenticated users can upload customer photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'customer-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own customer photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'customer-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own customer photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'customer-photos' AND auth.role() = 'authenticated');