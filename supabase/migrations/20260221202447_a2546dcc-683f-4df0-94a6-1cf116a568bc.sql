
-- Create table for tracking contact status of leads without cart items
CREATE TABLE public.crm_lead_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.store_leads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'contacted',
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, owner_id)
);

-- Enable RLS
ALTER TABLE public.crm_lead_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owners can view their own lead contacts"
ON public.crm_lead_contacts FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Owners can insert their own lead contacts"
ON public.crm_lead_contacts FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their own lead contacts"
ON public.crm_lead_contacts FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their own lead contacts"
ON public.crm_lead_contacts FOR DELETE
TO authenticated
USING (owner_id = auth.uid());
