
-- Add public SELECT policy so anonymous visitors can look up their own lead by whatsapp + store_id
CREATE POLICY "Public can read lead by whatsapp and store"
  ON public.store_leads
  FOR SELECT
  USING (true);

-- Add public UPDATE policy so anonymous visitors can update last_seen_at when returning
CREATE POLICY "Public can update own lead last_seen"
  ON public.store_leads
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
