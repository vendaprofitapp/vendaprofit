CREATE TABLE IF NOT EXISTS public.user_notification_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_key text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  dismissed_until timestamptz,
  UNIQUE(user_id, alert_key)
);

ALTER TABLE public.user_notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dismissals"
  ON public.user_notification_dismissals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dismissals"
  ON public.user_notification_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dismissals"
  ON public.user_notification_dismissals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissals"
  ON public.user_notification_dismissals FOR DELETE
  USING (auth.uid() = user_id);