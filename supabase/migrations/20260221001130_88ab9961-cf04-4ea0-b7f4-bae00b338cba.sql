
-- Fix Problema 2: Recriar trigger cart_created sem clausula WHEN
DROP TRIGGER IF EXISTS botconversa_cart_created_trigger ON public.lead_cart_items;

CREATE TRIGGER botconversa_cart_created_trigger
  AFTER INSERT ON public.lead_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_botconversa_cart_created();
