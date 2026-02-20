
CREATE TABLE IF NOT EXISTS public.botconversa_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'success' | 'failed' | 'skipped'
  error_message TEXT,
  botconversa_status INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.botconversa_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "Admins can read botconversa_logs"
ON public.botconversa_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Service role inserts (from edge function)
CREATE POLICY "Service role can insert botconversa_logs"
ON public.botconversa_logs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE INDEX idx_botconversa_logs_created_at ON public.botconversa_logs (created_at DESC);
CREATE INDEX idx_botconversa_logs_owner_id ON public.botconversa_logs (owner_id);
