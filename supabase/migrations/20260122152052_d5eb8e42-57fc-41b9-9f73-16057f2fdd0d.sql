-- Allow admins to manage any category

-- Categories already have RLS enabled; add admin override policies for UPDATE/DELETE.

CREATE POLICY "Admins can update any categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any categories"
ON public.categories
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
