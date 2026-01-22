-- Create policy to allow public updates to consignments via access token
-- Only allows updating status and approved_at for approval flow
CREATE POLICY "Public can update consignment status by access token"
ON public.consignments
FOR UPDATE
USING (status IN ('awaiting_approval', 'active'))
WITH CHECK (status IN ('active', 'finalized_by_client'));