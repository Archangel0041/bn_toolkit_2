-- Drop existing policies that allow public access
DROP POLICY IF EXISTS "Anyone can validate invite codes" ON public.invite_codes;

-- Keep admin policy but make it more restrictive (only admins can see/manage codes)
DROP POLICY IF EXISTS "Admins can manage invite codes" ON public.invite_codes;

-- Admins can view all invite codes
CREATE POLICY "Admins can view invite codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert new invite codes  
CREATE POLICY "Admins can create invite codes"
ON public.invite_codes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update invite codes
CREATE POLICY "Admins can update invite codes"
ON public.invite_codes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can delete invite codes
CREATE POLICY "Admins can delete invite codes"
ON public.invite_codes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));