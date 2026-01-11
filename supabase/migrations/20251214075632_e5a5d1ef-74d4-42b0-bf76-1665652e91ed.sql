-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'uploader');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, role)
);

-- Create profiles table for user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user can upload (is admin or uploader)
CREATE OR REPLACE FUNCTION public.can_upload(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'uploader')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can grant roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can revoke roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage policies for authenticated uploaders
CREATE POLICY "Uploaders can upload to unit-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'unit-images' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update unit-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'unit-images' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to ability-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ability-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update ability-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'ability-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to damage-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'damage-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update damage-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'damage-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to status-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'status-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update status-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'status-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to resource-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update resource-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resource-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to event-reward-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-reward-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update event-reward-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-reward-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to menu-backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-backgrounds' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update menu-backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-backgrounds' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to encounter-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'encounter-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update encounter-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'encounter-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can upload to mission-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mission-icons' AND public.can_upload(auth.uid()));

CREATE POLICY "Uploaders can update mission-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'mission-icons' AND public.can_upload(auth.uid()));