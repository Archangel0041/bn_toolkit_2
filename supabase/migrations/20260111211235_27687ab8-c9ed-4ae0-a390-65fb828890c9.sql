-- Create invite_codes table
CREATE TABLE public.invite_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to check if a code is valid (for signup validation)
CREATE POLICY "Anyone can validate invite codes"
  ON public.invite_codes
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()) AND current_uses < max_uses);

-- Only admins can manage invite codes
CREATE POLICY "Admins can manage invite codes"
  ON public.invite_codes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to validate and use an invite code (called during signup)
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
  
  -- Increment usage
  UPDATE public.invite_codes
  SET current_uses = current_uses + 1
  WHERE id = code_record.id;
  
  RETURN true;
END;
$$;

-- Insert a default invite code for testing
INSERT INTO public.invite_codes (code, max_uses, is_active)
VALUES ('WELCOME2025', 100, true);