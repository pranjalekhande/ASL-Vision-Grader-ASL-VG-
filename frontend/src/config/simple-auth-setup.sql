-- Ultra-Simple Auth Setup (Run this in Supabase SQL Editor)
-- This completely bypasses profile creation issues

-- 1. Drop the problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create a super simple profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'student',
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Disable all RLS
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.signs DISABLE ROW LEVEL SECURITY;

-- 4. Grant all permissions
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.signs TO anon, authenticated;

-- 5. Insert a test profile manually (you can delete this later)
-- Replace 'your-email@example.com' with an email you want to test with
/*
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- This will only work if you create the user through normal signup first
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'teacher@test.com' LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name) 
        VALUES (test_user_id, 'teacher', 'Test Teacher')
        ON CONFLICT (id) DO UPDATE SET role = 'teacher', full_name = 'Test Teacher';
    END IF;
END $$;
*/

