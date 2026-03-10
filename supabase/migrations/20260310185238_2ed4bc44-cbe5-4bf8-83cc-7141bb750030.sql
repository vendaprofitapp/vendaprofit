-- Add hub_description column to profiles table for supplier pitch/marketplace
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hub_description TEXT;
