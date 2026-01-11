-- Add intended_email and used_by columns to invite_codes table
-- This allows restricting invite codes to specific emails and tracking who used them

ALTER TABLE public.invite_codes
ADD COLUMN IF NOT EXISTS intended_email TEXT,
ADD COLUMN IF NOT EXISTS used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookups by intended_email
CREATE INDEX IF NOT EXISTS idx_invite_codes_intended_email ON public.invite_codes(intended_email);

-- Add index for faster lookups by used_by
CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by ON public.invite_codes(used_by);

-- Update the use_invite_code function to track who used the code and validate intended_email
CREATE OR REPLACE FUNCTION public.use_invite_code(invite_code TEXT, user_email TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_record RECORD;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();

  -- Find valid code
  SELECT * INTO code_record
  FROM public.invite_codes
  WHERE code = invite_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND current_uses < max_uses
    -- Check if intended_email matches (if specified)
    AND (intended_email IS NULL OR intended_email = user_email)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Increment usage and track who used it
  UPDATE public.invite_codes
  SET current_uses = current_uses + 1,
      used_by = CASE
        WHEN current_uses = 0 THEN current_user_id
        ELSE used_by
      END
  WHERE id = code_record.id;

  RETURN true;
END;
$$;

-- Add a function to check if an email can use a specific invite code
CREATE OR REPLACE FUNCTION public.can_use_invite_code(invite_code TEXT, user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.invite_codes
    WHERE code = invite_code
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND current_uses < max_uses
      AND (intended_email IS NULL OR intended_email = user_email)
  );
END;
$$;
