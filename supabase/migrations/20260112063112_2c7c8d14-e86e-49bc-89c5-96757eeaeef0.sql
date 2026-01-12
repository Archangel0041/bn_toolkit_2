-- Drop invite_codes table if it exists
DROP TABLE IF EXISTS public.invite_codes CASCADE;

-- Drop invite code related functions if they exist
DROP FUNCTION IF EXISTS public.use_invite_code(text);
DROP FUNCTION IF EXISTS public.validate_invite_code(text);
DROP FUNCTION IF EXISTS public.can_use_invite_code(uuid, text);
DROP FUNCTION IF EXISTS public.create_invite_code(text, integer);

-- Remove admin-related RLS policies from user_roles if they exist
DROP POLICY IF EXISTS "Admins can update user access" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;