
-- Permitir que o dono exclua conexões (convites pendentes principalmente)
CREATE POLICY "hub_connections_owner_delete" ON public.hub_connections
  FOR DELETE USING (owner_id = auth.uid());
