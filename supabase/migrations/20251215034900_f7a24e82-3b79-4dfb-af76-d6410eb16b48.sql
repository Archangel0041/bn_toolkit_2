-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create parties table for cloud storage of user battle parties
CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  units jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

-- Users can only view their own parties
CREATE POLICY "Users can view own parties"
ON public.parties FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own parties
CREATE POLICY "Users can create own parties"
ON public.parties FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own parties
CREATE POLICY "Users can update own parties"
ON public.parties FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own parties
CREATE POLICY "Users can delete own parties"
ON public.parties FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER update_parties_updated_at
BEFORE UPDATE ON public.parties
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();