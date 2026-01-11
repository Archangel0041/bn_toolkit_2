-- Create a function to validate invite code without consuming it
CREATE OR REPLACE FUNCTION public.validate_invite_code(invite_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.invite_codes
    WHERE code = invite_code
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND current_uses < max_uses
  );
END;
$$;

-- Update use_invite_code to also record who used it (called after account creation)
CREATE OR REPLACE FUNCTION public.use_invite_code(invite_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_record RECORD;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Find valid code
  SELECT * INTO code_record
  FROM public.invite_codes
  WHERE code = invite_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND current_uses < max_uses
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Mark as used and record who used it
  UPDATE public.invite_codes
  SET current_uses = current_uses + 1,
      is_active = false,
      used_by = current_user_id
  WHERE id = code_record.id;

  RETURN true;
END;
$$;