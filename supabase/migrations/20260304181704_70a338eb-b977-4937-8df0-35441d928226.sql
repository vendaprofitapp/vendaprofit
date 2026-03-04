
CREATE TABLE public.hub_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.hub_connections(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL,
  confirmed_by UUID,
  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation', 'confirmed', 'disputed')),
  seller_amount NUMERIC NOT NULL DEFAULT 0,
  owner_amount NUMERIC NOT NULL DEFAULT 0,
  splits_count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  dispute_reason TEXT,
  proposed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_settlements ENABLE ROW LEVEL SECURITY;

-- Both owner and seller of the connection can view settlements
CREATE POLICY "Hub connection members can view settlements"
  ON public.hub_settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hub_connections hc
      WHERE hc.id = connection_id
        AND (hc.owner_id = auth.uid() OR hc.seller_id = auth.uid())
    )
  );

-- Both can propose settlements
CREATE POLICY "Hub connection members can insert settlements"
  ON public.hub_settlements FOR INSERT
  WITH CHECK (
    auth.uid() = proposed_by
    AND EXISTS (
      SELECT 1 FROM public.hub_connections hc
      WHERE hc.id = connection_id
        AND (hc.owner_id = auth.uid() OR hc.seller_id = auth.uid())
    )
  );

-- The other party (not proposer) can update status to confirmed/disputed
CREATE POLICY "Hub connection partner can update settlement status"
  ON public.hub_settlements FOR UPDATE
  USING (
    auth.uid() != proposed_by
    AND EXISTS (
      SELECT 1 FROM public.hub_connections hc
      WHERE hc.id = connection_id
        AND (hc.owner_id = auth.uid() OR hc.seller_id = auth.uid())
    )
  );

CREATE INDEX idx_hub_settlements_connection ON public.hub_settlements(connection_id, proposed_at DESC);
