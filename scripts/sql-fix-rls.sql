-- Fix RLS policies for signs table
-- Run these commands in your Supabase SQL Editor

-- Option 1: Temporarily disable RLS for the signs table
-- (Easiest fix for development)
ALTER TABLE public.signs DISABLE ROW LEVEL SECURITY;

-- Option 2: Keep RLS enabled but allow anon access
-- (More secure approach)
-- First ensure RLS is enabled:
-- ALTER TABLE public.signs ENABLE ROW LEVEL SECURITY;

-- Then create permissive policies for anon role:
-- CREATE POLICY "Allow anon full access to signs" 
-- ON public.signs 
-- FOR ALL 
-- TO anon 
-- USING (true) 
-- WITH CHECK (true);

-- Option 3: Create specific policies for each operation
-- (Most secure approach)
-- ALTER TABLE public.signs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow anon select on signs" 
-- ON public.signs 
-- FOR SELECT 
-- TO anon 
-- USING (true);

-- CREATE POLICY "Allow anon insert on signs" 
-- ON public.signs 
-- FOR INSERT 
-- TO anon 
-- WITH CHECK (true);

-- CREATE POLICY "Allow anon update on signs" 
-- ON public.signs 
-- FOR UPDATE 
-- TO anon 
-- USING (true) 
-- WITH CHECK (true);

-- CREATE POLICY "Allow anon delete on signs" 
-- ON public.signs 
-- FOR DELETE 
-- TO anon 
-- USING (true);

-- After running one of the above options, you can test with:
-- SELECT * FROM public.signs LIMIT 1;

-- To check current RLS status:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename = 'signs' AND schemaname = 'public';

-- To view existing policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'signs' AND schemaname = 'public';


