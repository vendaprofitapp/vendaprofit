-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;

-- Create a new policy that allows all authenticated users to view all categories
CREATE POLICY "Users can view all categories" 
ON public.categories 
FOR SELECT 
USING (auth.uid() IS NOT NULL);