
-- Create waitlist_notifications table
CREATE TABLE public.waitlist_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  waitlist_id UUID NOT NULL REFERENCES public.product_waitlist(id) ON DELETE CASCADE,
  consignment_item_id UUID NOT NULL REFERENCES public.consignment_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waitlist_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Owner of the product can read notifications
CREATE POLICY "Product owners can view waitlist notifications"
ON public.waitlist_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = waitlist_notifications.product_id
      AND p.owner_id = auth.uid()
  )
);

-- RLS: Owner can update notification status
CREATE POLICY "Product owners can update waitlist notifications"
ON public.waitlist_notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = waitlist_notifications.product_id
      AND p.owner_id = auth.uid()
  )
);

-- RLS: Owner can delete notifications
CREATE POLICY "Product owners can delete waitlist notifications"
ON public.waitlist_notifications
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = waitlist_notifications.product_id
      AND p.owner_id = auth.uid()
  )
);

-- Create trigger function for when consignment item is returned
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_consignment_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status changes to 'returned'
  IF NEW.status = 'returned' AND (OLD.status IS DISTINCT FROM 'returned') THEN
    INSERT INTO public.waitlist_notifications (product_id, waitlist_id, consignment_item_id)
    SELECT NEW.product_id, pw.id, NEW.id
    FROM public.product_waitlist pw
    WHERE pw.product_id = NEW.product_id
      AND pw.status = 'waiting';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on consignment_items
CREATE TRIGGER on_consignment_item_returned
AFTER UPDATE ON public.consignment_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_waitlist_on_consignment_return();
