
-- 1. event_quick_buttons
CREATE TABLE public.event_quick_buttons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  label text NOT NULL,
  default_price numeric,
  color text NOT NULL DEFAULT '#8B5CF6',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_quick_buttons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quick buttons" ON public.event_quick_buttons FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can create own quick buttons" ON public.event_quick_buttons FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own quick buttons" ON public.event_quick_buttons FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own quick buttons" ON public.event_quick_buttons FOR DELETE USING (owner_id = auth.uid());

-- 2. event_sale_drafts
CREATE TABLE public.event_sale_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  photo_urls text[] DEFAULT '{}',
  items jsonb NOT NULL DEFAULT '[]',
  notes text,
  estimated_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_sale_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sale drafts" ON public.event_sale_drafts FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can create own sale drafts" ON public.event_sale_drafts FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own sale drafts" ON public.event_sale_drafts FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own sale drafts" ON public.event_sale_drafts FOR DELETE USING (owner_id = auth.uid());

CREATE TRIGGER update_event_sale_drafts_updated_at
  BEFORE UPDATE ON public.event_sale_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Storage bucket event-photos
INSERT INTO storage.buckets (id, name, public) VALUES ('event-photos', 'event-photos', true);

CREATE POLICY "Anyone can view event photos" ON storage.objects FOR SELECT USING (bucket_id = 'event-photos');
CREATE POLICY "Users can upload own event photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own event photos" ON storage.objects FOR DELETE USING (bucket_id = 'event-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
