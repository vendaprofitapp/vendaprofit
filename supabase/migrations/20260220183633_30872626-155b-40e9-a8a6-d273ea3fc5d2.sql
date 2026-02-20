
-- Enable pg_net extension for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create system_settings table for global admin configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write system_settings
CREATE POLICY "Admins can manage system_settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default botconversa_enabled setting
INSERT INTO public.system_settings (key, value)
VALUES ('botconversa_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Function to call botconversa-notify edge function via pg_net
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
    _project_url := 'https://dghbxwpxgsuprlksiklv.supabase.co';
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

-- Trigger function: new lead
CREATE OR REPLACE FUNCTION public.trigger_botconversa_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_botconversa_notify(
    'new_lead',
    NEW.owner_id::text,
    jsonb_build_object(
      'lead_id', NEW.id,
      'name', NEW.name,
      'phone', NEW.phone,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger function: cart created
CREATE OR REPLACE FUNCTION public.trigger_botconversa_cart_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id TEXT;
  _lead_name TEXT;
BEGIN
  -- Get the owner_id and lead name from store_leads
  SELECT sl.owner_id::text, sl.name INTO _owner_id, _lead_name
  FROM public.store_leads sl
  WHERE sl.id = NEW.lead_id;

  IF _owner_id IS NOT NULL THEN
    PERFORM public.call_botconversa_notify(
      'cart_created',
      _owner_id,
      jsonb_build_object(
        'lead_id', NEW.lead_id,
        'lead_name', _lead_name,
        'product_name', NEW.product_name,
        'quantity', NEW.quantity,
        'unit_price', NEW.unit_price,
        'selected_size', NEW.selected_size,
        'variant_color', NEW.variant_color
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function: catalog sale
CREATE OR REPLACE FUNCTION public.trigger_botconversa_catalog_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'catalog' THEN
    PERFORM public.call_botconversa_notify(
      'catalog_sale',
      NEW.owner_id::text,
      jsonb_build_object(
        'sale_id', NEW.id,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'total', NEW.total,
        'payment_method', NEW.payment_method,
        'items', NEW.items
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function: consignment finalized by client
CREATE OR REPLACE FUNCTION public.trigger_botconversa_consignment_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finalized_by_client' AND (OLD.status IS DISTINCT FROM 'finalized_by_client') THEN
    PERFORM public.call_botconversa_notify(
      'consignment_finalized',
      NEW.seller_id::text,
      jsonb_build_object(
        'consignment_id', NEW.id,
        'customer_id', NEW.customer_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create the 4 triggers
CREATE TRIGGER botconversa_new_lead_trigger
  AFTER INSERT ON public.store_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_botconversa_new_lead();

CREATE TRIGGER botconversa_cart_created_trigger
  AFTER INSERT ON public.lead_cart_items
  FOR EACH ROW
  WHEN (NEW.status = 'waiting')
  EXECUTE FUNCTION public.trigger_botconversa_cart_created();

CREATE TRIGGER botconversa_catalog_sale_trigger
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_botconversa_catalog_sale();

CREATE TRIGGER botconversa_consignment_finalized_trigger
  AFTER UPDATE ON public.consignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_botconversa_consignment_finalized();
