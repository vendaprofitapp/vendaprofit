-- Add group_id column to marketing_tasks for group recommendations
ALTER TABLE public.marketing_tasks ADD COLUMN group_id uuid;

-- Index for efficient lookups
CREATE INDEX idx_marketing_tasks_group_id ON public.marketing_tasks (group_id) WHERE group_id IS NOT NULL;