
-- Add CPF field to customers table
ALTER TABLE public.customers ADD COLUMN cpf text;

-- Add seller CPF to profiles table
ALTER TABLE public.profiles ADD COLUMN cpf text;
