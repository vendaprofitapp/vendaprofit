
CREATE TABLE public.crm_customer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'contacted',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crm contacts" ON public.crm_customer_contacts FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own crm contacts" ON public.crm_customer_contacts FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own crm contacts" ON public.crm_customer_contacts FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own crm contacts" ON public.crm_customer_contacts FOR DELETE USING (owner_id = auth.uid());

CREATE UNIQUE INDEX idx_crm_customer_contacts_unique ON public.crm_customer_contacts(customer_id, owner_id);
