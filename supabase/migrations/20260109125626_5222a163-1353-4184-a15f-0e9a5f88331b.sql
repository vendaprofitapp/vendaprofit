-- Add AI configuration columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_ai_provider text DEFAULT 'gemini' CHECK (preferred_ai_provider IN ('gemini', 'openai')),
ADD COLUMN IF NOT EXISTS gemini_api_key text,
ADD COLUMN IF NOT EXISTS openai_api_key text;

-- Create RLS policies to ensure only the user can view/edit their own API keys
-- First, drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate policies ensuring API keys are protected
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferred_ai_provider IS 'User preferred AI provider: gemini or openai';
COMMENT ON COLUMN public.profiles.gemini_api_key IS 'User Google Gemini API key for BYOK';
COMMENT ON COLUMN public.profiles.openai_api_key IS 'User OpenAI API key for BYOK';