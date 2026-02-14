
-- 1. catalog_product_views
CREATE TABLE public.catalog_product_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_product_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert product views"
  ON public.catalog_product_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can view their product views"
  ON public.catalog_product_views FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their product views"
  ON public.catalog_product_views FOR DELETE
  USING (owner_id = auth.uid());

CREATE INDEX idx_catalog_product_views_owner_id ON public.catalog_product_views (owner_id);
CREATE INDEX idx_catalog_product_views_product_id ON public.catalog_product_views (product_id);
CREATE INDEX idx_catalog_product_views_store_id ON public.catalog_product_views (store_id);
CREATE INDEX idx_catalog_product_views_created_at ON public.catalog_product_views (created_at);

-- 2. catalog_search_logs
CREATE TABLE public.catalog_search_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  search_term text NOT NULL,
  results_count integer NOT NULL DEFAULT 0,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert search logs"
  ON public.catalog_search_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can view their search logs"
  ON public.catalog_search_logs FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their search logs"
  ON public.catalog_search_logs FOR DELETE
  USING (owner_id = auth.uid());

CREATE INDEX idx_catalog_search_logs_owner_id ON public.catalog_search_logs (owner_id);
CREATE INDEX idx_catalog_search_logs_store_id ON public.catalog_search_logs (store_id);
CREATE INDEX idx_catalog_search_logs_search_term ON public.catalog_search_logs (search_term);

-- 3. marketing_tasks
CREATE TABLE public.marketing_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  product_id uuid,
  task_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  product_name text,
  metric_value integer DEFAULT 0,
  metric_secondary numeric DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  expires_at timestamptz,
  store_slug text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their marketing tasks"
  ON public.marketing_tasks FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can insert their marketing tasks"
  ON public.marketing_tasks FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their marketing tasks"
  ON public.marketing_tasks FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their marketing tasks"
  ON public.marketing_tasks FOR DELETE
  USING (owner_id = auth.uid());

CREATE INDEX idx_marketing_tasks_owner_id ON public.marketing_tasks (owner_id);
CREATE INDEX idx_marketing_tasks_task_type ON public.marketing_tasks (task_type);
CREATE INDEX idx_marketing_tasks_is_completed ON public.marketing_tasks (is_completed);
