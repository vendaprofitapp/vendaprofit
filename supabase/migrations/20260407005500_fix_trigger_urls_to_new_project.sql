-- =============================================================
-- FIX: Atualizar URLs hardcoded nos triggers do banco antigo (Lovable)
-- para o novo projeto Supabase (nkmktefsbvhjexodkbtw)
-- Isso resolve a lentidão geral do sistema, pois os triggers
-- estavam tentando fazer HTTP calls para um servidor que não responde.
-- =============================================================

-- 1. Fix call_botconversa_notify - update fallback URL
CREATE OR REPLACE FUNCTION public.call_botconversa_notify(
  p_event_type TEXT,
  p_owner_id TEXT,
  p_payload JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled TEXT;
  _project_url TEXT;
BEGIN
  -- Check if botconversa is enabled
  SELECT value INTO _enabled FROM public.system_settings WHERE key = 'botconversa_enabled';
  IF _enabled IS DISTINCT FROM 'true' THEN
    RETURN;
  END IF;

  _project_url := current_setting('app.settings.project_url', true);
  IF _project_url IS NULL OR _project_url = '' THEN
    _project_url := 'https://nkmktefsbvhjexodkbtw.supabase.co';
  END IF;

  PERFORM extensions.http_post(
    url := _project_url || '/functions/v1/botconversa-notify',
    body := jsonb_build_object(
      'event_type', p_event_type,
      'owner_id', p_owner_id,
      'payload', p_payload
    )::text,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  -- Silently ignore errors to not block the main transaction
  NULL;
END;
$$;

-- 2. Fix trigger_always_profit_webhook - update fallback URL
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
    _project_url := 'https://nkmktefsbvhjexodkbtw.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rbWt0ZWZzYnZoamV4b2RrYnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjMwNjksImV4cCI6MjA5MDYzOTA2OX0.oz3GFu0uUtNpzQEj-ei3Ml4LGiKM6Y_mVBjBiWJ8nDQ';
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
