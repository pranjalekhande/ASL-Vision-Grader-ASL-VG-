-- Simple setup for ASL Vision Grader
-- Run this in your Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create signs table (simplified - no complex relationships)
CREATE TABLE IF NOT EXISTS public.signs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gloss TEXT NOT NULL UNIQUE,
  exemplar_landmarks JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for now to avoid permission issues
ALTER TABLE public.signs DISABLE ROW LEVEL SECURITY;

-- Insert some default signs if they don't exist
INSERT INTO public.signs (gloss, exemplar_landmarks) 
VALUES 
  ('HELLO', '{"frames": []}'),
  ('YES', '{"frames": []}'),
  ('NO', '{"frames": []}'),
  ('THANK-YOU', '{"frames": []}'),
  ('PLEASE', '{"frames": []}')
ON CONFLICT (gloss) DO NOTHING;

-- Grant permissions
GRANT ALL ON public.signs TO anon;
GRANT ALL ON public.signs TO authenticated;


