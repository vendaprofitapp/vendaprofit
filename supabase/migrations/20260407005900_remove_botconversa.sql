-- =============================================================
-- Remove ALL BotConversa triggers, functions and related objects
-- This feature is not in use and the triggers add unnecessary
-- overhead to every transaction.
-- =============================================================

-- 1. Drop all BotConversa triggers
DROP TRIGGER IF EXISTS botconversa_new_lead_trigger ON public.store_leads;
DROP TRIGGER IF EXISTS botconversa_cart_created_trigger ON public.lead_cart_items;
DROP TRIGGER IF EXISTS botconversa_catalog_sale_trigger ON public.sales;
DROP TRIGGER IF EXISTS botconversa_consignment_finalized_trigger ON public.consignments;

-- 2. Drop all BotConversa trigger functions
DROP FUNCTION IF EXISTS public.trigger_botconversa_new_lead() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_botconversa_cart_created() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_botconversa_catalog_sale() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_botconversa_consignment_finalized() CASCADE;

-- 3. Drop the main notify helper function
DROP FUNCTION IF EXISTS public.call_botconversa_notify(TEXT, TEXT, JSONB) CASCADE;

-- 4. Remove botconversa system setting
DELETE FROM public.system_settings WHERE key = 'botconversa_enabled';
