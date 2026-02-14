
-- Tabela user_ad_integrations
CREATE TABLE public.user_ad_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  platform text NOT NULL,
  access_token text,
  refresh_token text,
  account_id text,
  account_name text,
  is_active boolean NOT NULL DEFAULT true,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_ad_integrations_owner_platform_unique UNIQUE (owner_id, platform)
);

ALTER TABLE public.user_ad_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations" ON public.user_ad_integrations FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own integrations" ON public.user_ad_integrations FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own integrations" ON public.user_ad_integrations FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own integrations" ON public.user_ad_integrations FOR DELETE USING (owner_id = auth.uid());

CREATE TRIGGER update_user_ad_integrations_updated_at BEFORE UPDATE ON public.user_ad_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela ad_campaigns
CREATE TABLE public.ad_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.user_ad_integrations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  platform text NOT NULL,
  platform_campaign_id text,
  campaign_name text,
  daily_budget numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  campaign_type text,
  target_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON public.ad_campaigns FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own campaigns" ON public.ad_campaigns FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own campaigns" ON public.ad_campaigns FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own campaigns" ON public.ad_campaigns FOR DELETE USING (owner_id = auth.uid());

CREATE TRIGGER update_ad_campaigns_updated_at BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger "Always Profit": pausa anúncios quando stock chega a 0
CREATE OR REPLACE FUNCTION public.check_stock_and_pause_ads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _campaign RECORD;
  _product_name text;
BEGIN
  -- Só dispara quando stock_quantity muda para 0
  IF NEW.stock_quantity = 0 AND OLD.stock_quantity > 0 THEN
    _product_name := NEW.name;
    
    -- Pausar todas as campanhas ativas deste produto
    FOR _campaign IN
      SELECT id, daily_budget, owner_id FROM public.ad_campaigns
      WHERE product_id = NEW.id AND status = 'active'
    LOOP
      UPDATE public.ad_campaigns SET status = 'paused_no_stock' WHERE id = _campaign.id;
      
      -- Criar task de aviso no marketing
      INSERT INTO public.marketing_tasks (owner_id, task_type, title, description, product_id, product_name, metric_value)
      VALUES (
        _campaign.owner_id,
        'ad_stock_paused',
        'Anúncios pausados - ' || _product_name || ' esgotou!',
        'Os anúncios foram pausados automaticamente porque o stock acabou. Orçamento diário de R$ ' || _campaign.daily_budget || '/dia foi salvo!',
        NEW.id,
        _product_name,
        _campaign.daily_budget
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_stock_pause_ads_trigger
AFTER UPDATE OF stock_quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.check_stock_and_pause_ads();

-- Trigger para variantes: quando stock chega a 0, verificar se TODAS variantes do produto estão zeradas
CREATE OR REPLACE FUNCTION public.check_variant_stock_and_pause_ads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_variant_stock integer;
  _campaign RECORD;
  _product_name text;
BEGIN
  IF NEW.stock_quantity = 0 AND OLD.stock_quantity > 0 THEN
    -- Verificar se todas as variantes do produto estão com stock 0
    SELECT COALESCE(SUM(stock_quantity), 0) INTO _total_variant_stock
    FROM public.product_variants
    WHERE product_id = NEW.product_id;
    
    IF _total_variant_stock = 0 THEN
      SELECT name INTO _product_name FROM public.products WHERE id = NEW.product_id;
      
      FOR _campaign IN
        SELECT id, daily_budget, owner_id FROM public.ad_campaigns
        WHERE product_id = NEW.product_id AND status = 'active'
      LOOP
        UPDATE public.ad_campaigns SET status = 'paused_no_stock' WHERE id = _campaign.id;
        
        INSERT INTO public.marketing_tasks (owner_id, task_type, title, description, product_id, product_name, metric_value)
        VALUES (
          _campaign.owner_id,
          'ad_stock_paused',
          'Anúncios pausados - ' || _product_name || ' esgotou!',
          'Os anúncios foram pausados automaticamente porque todas as variantes esgotaram. Orçamento diário de R$ ' || _campaign.daily_budget || '/dia foi salvo!',
          NEW.product_id,
          _product_name,
          _campaign.daily_budget
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_variant_stock_pause_ads_trigger
AFTER UPDATE OF stock_quantity ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.check_variant_stock_and_pause_ads();
