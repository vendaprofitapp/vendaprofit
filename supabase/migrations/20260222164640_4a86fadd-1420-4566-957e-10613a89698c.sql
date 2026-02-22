CREATE OR REPLACE FUNCTION public.trigger_botconversa_new_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.call_botconversa_notify(
    'new_lead',
    NEW.owner_id::text,
    jsonb_build_object(
      'lead_id', NEW.id,
      'name', NEW.name,
      'phone', NEW.whatsapp,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$function$;