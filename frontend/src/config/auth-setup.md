# 2FA Authentication Setup Guide

## Step 1: Configure Supabase 2FA Settings

1. **Go to Authentication > Settings** in your Supabase dashboard
2. **Enable Multi-Factor Authentication**:
   - Toggle ON "Enable Multi-Factor Authentication"
   - Set max enrollment limit (e.g., 2 devices)
3. **Configure Phone/SMS** (optional):
   - Add Twilio credentials if you want SMS 2FA
4. **Configure Email settings**:
   - Ensure email templates are set up for 2FA codes

## Step 2: Database Schema for Roles

Run this SQL in your Supabase SQL Editor:

```sql
-- Create user_role enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update profiles table to ensure proper structure
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'student',
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS institution TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'student')::user_role,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$ language plpgsql security definer;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Teachers can view all student profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles teacher_profile
      WHERE teacher_profile.id = auth.uid()
      AND teacher_profile.role IN ('teacher', 'admin')
    )
  );

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

## Step 3: Environment Variables

Add these to your `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_APP_NAME="ASL Vision Grader"
VITE_SUPPORT_EMAIL=support@yourschool.edu
```

