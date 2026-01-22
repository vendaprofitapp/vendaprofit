-- Adicionar campo para domínio personalizado nas configurações da loja
ALTER TABLE public.store_settings 
ADD COLUMN custom_domain TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.store_settings.custom_domain IS 'Domínio personalizado para links públicos (ex: vendaprofit.com.br)';