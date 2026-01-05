-- Fix: allow group creation whenever a valid authenticated JWT is present,
-- even if the database role is not `authenticated`.
-- Unauthenticated requests still fail because auth.uid() will be NULL.

ALTER POLICY "Authenticated users can create groups"
ON public.groups
TO public;