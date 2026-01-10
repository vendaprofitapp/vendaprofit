-- Add new columns to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS attendant_name text,
ADD COLUMN IF NOT EXISTS attendant_phone text,
ADD COLUMN IF NOT EXISTS purchase_rules text;

-- Rename 'phone' to 'general_phone' for clarity (we'll keep the original column and add alias via application)
COMMENT ON COLUMN public.suppliers.phone IS 'General phone number of the supplier';
COMMENT ON COLUMN public.suppliers.attendant_name IS 'Name of the primary contact/attendant';
COMMENT ON COLUMN public.suppliers.attendant_phone IS 'Phone number of the attendant';
COMMENT ON COLUMN public.suppliers.purchase_rules IS 'Free text field for purchase rules and conditions';