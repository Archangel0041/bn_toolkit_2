-- Add RLS policy for admins to update user_roles
-- This adds server-side authorization so admin actions are protected by RLS

-- Policy: Admins (users with has_access = true) can update other users' access
CREATE POLICY "Admins can update user access"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND has_access = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND has_access = true
  )
);

-- Policy: Admins can view all user roles (needed for admin page)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND has_access = true
  )
);

-- Add validation constraints to parties.units JSONB column
-- Ensures units is always an array with max 14 elements (grid positions)
ALTER TABLE public.parties ADD CONSTRAINT units_is_array 
  CHECK (jsonb_typeof(units) = 'array');

ALTER TABLE public.parties ADD CONSTRAINT units_max_size 
  CHECK (jsonb_array_length(units) <= 14);

-- Add function to validate party unit structure
CREATE OR REPLACE FUNCTION public.validate_party_units(units_json JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Empty array is valid
  IF jsonb_array_length(units_json) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Check all elements have required fields with correct types and ranges
  RETURN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(units_json) u
    WHERE NOT (
      jsonb_typeof(u->'unitId') = 'number' AND
      jsonb_typeof(u->'gridId') = 'number' AND
      jsonb_typeof(u->'rank') = 'number' AND
      (u->>'gridId')::int BETWEEN 0 AND 13 AND
      (u->>'rank')::int BETWEEN 1 AND 10
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Add constraint using the validation function
ALTER TABLE public.parties ADD CONSTRAINT units_valid_schema 
  CHECK (validate_party_units(units));