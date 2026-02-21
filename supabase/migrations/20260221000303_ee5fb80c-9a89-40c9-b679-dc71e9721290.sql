
CREATE OR REPLACE FUNCTION public.call_botconversa_notify(p_event_type text, p_owner_id text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _enabled TEXT;
  _project_url TEXT;
  _anon_key TEXT;
BEGIN
  -- Check if botconversa is enabled
  SELECT value INTO _enabled FROM public.system_settings WHERE key = 'botconversa_enabled';
  IF _enabled IS DISTINCT FROM 'true' THEN
    RETURN;
  END IF;

  _project_url := current_setting('app.settings.project_url', true);
  IF _project_url IS NULL OR _project_url = '' THEN
    _project_url := 'https://dghbxwpxgsuprlksiklv.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaGJ4d3B4Z3N1cHJsa3Npa2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODg3MjUsImV4cCI6MjA4MzM2NDcyNX0.J6ae7-ZgxOFiGpV5SC_Hjkk3vPV-74rGtO4Pg1WyJDQ';
  END IF;

  PERFORM net.http_post(
    url := _project_url || '/functions/v1/botconversa-notify',
    body := jsonb_build_object(
      'event_type', p_event_type,
      'owner_id', p_owner_id,
      'payload', p_payload
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'apikey', _anon_key
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Silently ignore errors to not block the main transaction
  NULL;
END;
$function$;
