
CREATE TABLE public.brand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_name text NOT NULL,
  b2c_url text,
  b2b_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own brand requests"
  ON public.brand_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own brand requests"
  ON public.brand_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all brand requests"
  ON public.brand_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update brand requests"
  ON public.brand_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
