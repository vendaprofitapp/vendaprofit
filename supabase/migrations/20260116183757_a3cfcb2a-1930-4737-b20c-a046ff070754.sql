-- Add website column to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS website TEXT;