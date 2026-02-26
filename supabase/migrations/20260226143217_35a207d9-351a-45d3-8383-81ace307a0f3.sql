
-- Permitir que o usuário veja convites pelo seu e-mail (antes de aceitar, seller_id ainda é null)
CREATE POLICY "hub_connections_invited_read" ON public.hub_connections
  FOR SELECT USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
