-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Requesters can cancel own requests" ON public.stock_requests;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Requesters can cancel own requests"
ON public.stock_requests
FOR UPDATE
USING (requester_id = auth.uid() AND status = 'pending')
WITH CHECK (requester_id = auth.uid() AND status = 'cancelled');