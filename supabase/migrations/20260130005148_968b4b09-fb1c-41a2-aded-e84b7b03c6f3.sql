
-- Atualizar a RLS policy para que usuários vejam apenas suas próprias categorias
DROP POLICY IF EXISTS "Users can view all categories" ON categories;

CREATE POLICY "Users can view own categories" 
ON categories 
FOR SELECT 
USING (owner_id = auth.uid());
