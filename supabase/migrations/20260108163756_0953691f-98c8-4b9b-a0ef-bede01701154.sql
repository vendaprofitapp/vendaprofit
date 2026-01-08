-- Create table to track AI fitting room usage per user
CREATE TABLE public.ai_fitting_room_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_fitting_room_usage ENABLE ROW LEVEL SECURITY;

-- Users can insert their own usage records
CREATE POLICY "Users can insert their own usage" 
ON public.ai_fitting_room_usage 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own usage
CREATE POLICY "Users can view their own usage" 
ON public.ai_fitting_room_usage 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for efficient querying
CREATE INDEX idx_ai_fitting_room_usage_user_time ON public.ai_fitting_room_usage(user_id, created_at DESC);

-- Function to clean old usage records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_fitting_room_usage()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.ai_fitting_room_usage WHERE created_at < now() - interval '1 hour';
$$;