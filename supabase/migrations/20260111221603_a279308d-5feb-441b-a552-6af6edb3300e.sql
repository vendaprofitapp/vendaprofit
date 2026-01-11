-- Create colors table for user-defined colors
CREATE TABLE public.colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hex_code TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own colors" 
ON public.colors 
FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own colors" 
ON public.colors 
FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own colors" 
ON public.colors 
FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own colors" 
ON public.colors 
FOR DELETE 
USING (owner_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_colors_updated_at
BEFORE UPDATE ON public.colors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_colors_owner_id ON public.colors(owner_id);