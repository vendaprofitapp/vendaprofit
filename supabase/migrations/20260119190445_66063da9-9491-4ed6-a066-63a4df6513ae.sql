-- Criar bucket para banners de lojas
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-banners', 'store-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Policy para visualização pública
CREATE POLICY "Store banners are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-banners');

-- Policy para upload pelo dono da loja
CREATE POLICY "Users can upload their own store banners"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy para atualização pelo dono
CREATE POLICY "Users can update their own store banners"
ON storage.objects FOR UPDATE
USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy para deleção pelo dono
CREATE POLICY "Users can delete their own store banners"
ON storage.objects FOR DELETE
USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);