-- Add DELETE policy to profiles table for GDPR compliance
-- Allow users to delete their own profile
CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Allow admins to delete any profile
CREATE POLICY "Admins can delete any profile"
ON public.profiles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));