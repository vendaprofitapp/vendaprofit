
CREATE TABLE public.partner_point_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  partner_point_id UUID NOT NULL REFERENCES public.partner_points(id) ON DELETE CASCADE,
  settled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  sales_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_point_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settlements"
  ON public.partner_point_settlements FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own settlements"
  ON public.partner_point_settlements FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own settlements"
  ON public.partner_point_settlements FOR DELETE
  USING (auth.uid() = owner_id);

CREATE INDEX idx_partner_point_settlements_partner
  ON public.partner_point_settlements(partner_point_id, settled_at DESC);
