
-- Corrigir a política que causava "permission denied for table users"
DROP POLICY IF EXISTS "hub_connections_invited_read" ON public.hub_connections;

-- Recriar usando auth.jwt() em vez de SELECT FROM auth.users
CREATE POLICY "hub_connections_invited_read" ON public.hub_connections
  FOR SELECT USING (
    invited_email = (auth.jwt() ->> 'email')
  );
