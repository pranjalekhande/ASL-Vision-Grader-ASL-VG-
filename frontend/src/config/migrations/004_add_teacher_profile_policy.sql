-- Add policy for teachers to view all profiles
CREATE POLICY "Teachers can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Add policy for teachers to view all students
CREATE POLICY "Teachers can view student data"
  ON profiles FOR SELECT
  USING (
    (auth.uid() = id) -- User can view their own profile
    OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
