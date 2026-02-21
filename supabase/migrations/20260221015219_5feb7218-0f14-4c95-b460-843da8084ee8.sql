
-- =============================================================
-- Trigger: Notificar Always Profit Dashboard via Edge Function
-- Dispara assincronamente após INSERT na tabela sales usando pg_net
-- =============================================================

CREATE OR REPLACE FUNCTION public.trigger_always_profit_webhook()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _project_url TEXT;
  _anon_key TEXT;
BEGIN
  -- Só disparar para vendas concluídas
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  _project_url := current_setting('app.settings.project_url', true);
  IF _project_url IS NULL OR _project_url = '' THEN
    _project_url := 'https://dghbxwpxgsuprlksiklv.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaGJ4d3B4Z3N1cHJsa3Npa2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODg3MjUsImV4cCI6MjA4MzM2NDcyNX0.J6ae7-ZgxOFiGpV5SC_Hjkk3vPV-74rGtO4Pg1WyJDQ';
  END IF;

  -- Chamada assíncrona via pg_net (não bloqueia a transação)
  PERFORM net.http_post(
    url := _project_url || '/functions/v1/always-profit-webhook',
    body := jsonb_build_object('sale_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'apikey', _anon_key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear a venda por falha no webhook
  RAISE WARNING '[always-profit-webhook] Failed to dispatch: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Criar trigger na tabela sales
DROP TRIGGER IF EXISTS trg_always_profit_webhook ON public.sales;
CREATE TRIGGER trg_always_profit_webhook
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_always_profit_webhook();
