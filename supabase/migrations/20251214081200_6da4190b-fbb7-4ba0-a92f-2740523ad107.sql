-- Fix: Restrict profile email visibility to owner only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create policy allowing users to view all profiles but emails are only visible via separate mechanism
-- Using a column-level approach via application logic instead of blocking entire rows
-- Option: Admin and self can see all fields, others see only non-email fields

-- Policy 1: Users can view their own full profile (including email)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Admins can view all profiles (for admin panel)
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policy 3: Allow viewing public profile fields (display_name, id) for other users
-- This requires a different approach - we'll use a view for public profile data
-- For now, the above two policies cover the main use cases