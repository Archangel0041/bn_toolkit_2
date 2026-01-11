-- Update invite_codes table to add intended_email and make single-use
ALTER TABLE public.invite_codes 
  ADD COLUMN intended_email TEXT,
  ALTER COLUMN max_uses SET DEFAULT 1;

-- Update existing codes to be single-use
UPDATE public.invite_codes SET max_uses = 1 WHERE max_uses > 1;

-- Add column to track which user used the code
ALTER TABLE public.invite_codes ADD COLUMN used_by UUID REFERENCES auth.users(id);

-- Update the use_invite_code function to record who used it
CREATE OR REPLACE FUNCTION public.use_invite_code(invite_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_record RECORD;
BEGIN
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
  
  -- Mark as used (single-use)
  UPDATE public.invite_codes
  SET current_uses = current_uses + 1,
      is_active = false
  WHERE id = code_record.id;
  
  RETURN true;
END;
$$;

-- Function to create invite codes (admin only, called from frontend)
CREATE OR REPLACE FUNCTION public.create_invite_code(intended_email_param TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  user_id UUID;
BEGIN
  -- Check if user is admin
  user_id := auth.uid();
  IF NOT public.has_role(user_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can create invite codes';
  END IF;
  
  -- Generate a random 8-character code
  new_code := upper(substr(md5(random()::text), 1, 8));
  
  -- Insert the code
  INSERT INTO public.invite_codes (code, created_by, intended_email, max_uses, is_active)
  VALUES (new_code, user_id, intended_email_param, 1, true);
  
  RETURN new_code;
END;
$$;