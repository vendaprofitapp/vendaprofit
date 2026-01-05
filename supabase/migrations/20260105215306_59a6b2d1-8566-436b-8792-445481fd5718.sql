-- Remove the problematic INSERT policy that checks is_group_member
-- which creates a chicken-and-egg problem (can't insert group without being a member,
-- but can't be a member without the group existing)

DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;

-- Create a simpler policy that just checks if user is authenticated
CREATE POLICY "Authenticated users can create groups"
ON public.groups
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- Ensure the trigger function exists and automatically adds creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add the creator as an owner member
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_group_created ON public.groups;

-- Create trigger to run after group insertion
CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_group();