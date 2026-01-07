-- Create the trigger that was missing
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert profile for existing user (using auth.users email lookup)
INSERT INTO public.profiles (id, full_name, email)
SELECT id, COALESCE(raw_user_meta_data ->> 'full_name', 'Usuário'), email
FROM auth.users
WHERE email = 'leobergconsultoria@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- Add admin role for the user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'leobergconsultoria@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;