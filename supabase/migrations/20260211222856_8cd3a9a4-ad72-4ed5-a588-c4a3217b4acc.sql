-- Fix: Add WITH CHECK to allow the requester to set status to 'cancelled'
DROP POLICY "Requesters can cancel own requests" ON public.stock_requests;

CREATE POLICY "Requesters can cancel own requests"
ON public.stock_requests
FOR UPDATE
USING (requester_id = auth.uid() AND status = 'pending')
WITH CHECK (requester_id = auth.uid() AND status = 'cancelled');
