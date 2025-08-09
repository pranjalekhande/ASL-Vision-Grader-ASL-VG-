-- Complete Authentication Setup for ASL Vision Grader
-- Run this in your Supabase SQL Editor

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create user role enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'teacher');
    END IF;
END
$$;

-- 3. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'student',
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- 4. Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')::user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- 5. Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 8. Create helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT role INTO user_role_result
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role_result, 'student'::user_role);
END;
$$;

-- 9. Create helper function to check if user is teacher
CREATE OR REPLACE FUNCTION public.is_teacher(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.get_user_role(user_id) = 'teacher';
END;
$$;

-- 10. Update signs table policies (if needed)
DROP POLICY IF EXISTS "Anyone can view signs" ON public.signs;
CREATE POLICY "Anyone can view signs" 
ON public.signs FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Teachers can insert signs" ON public.signs;
CREATE POLICY "Teachers can insert signs" 
ON public.signs FOR INSERT 
WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can update signs" ON public.signs;
CREATE POLICY "Teachers can update signs" 
ON public.signs FOR UPDATE 
USING (public.is_teacher());

-- 11. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.signs TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher TO anon, authenticated;

-- 12. Insert test teacher account (optional)
-- Uncomment and modify if you want a default teacher account
/*
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'teacher@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"role": "teacher", "full_name": "Test Teacher"}'::jsonb,
  NOW(),
  NOW()
);
*/

