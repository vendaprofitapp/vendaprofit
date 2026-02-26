
ALTER TABLE public.hub_connections DROP CONSTRAINT IF EXISTS hub_connections_status_check;
ALTER TABLE public.hub_connections ADD CONSTRAINT hub_connections_status_check 
  CHECK (status IN ('pending', 'active', 'suspended', 'archived'));
