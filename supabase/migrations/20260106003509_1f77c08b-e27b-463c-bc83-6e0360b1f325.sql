-- Create categories table
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own categories"
  ON public.categories
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own categories"
  ON public.categories
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own categories"
  ON public.categories
  FOR DELETE
  USING (owner_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();