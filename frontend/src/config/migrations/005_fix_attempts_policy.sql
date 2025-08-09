-- Drop ALL existing attempts policies first
DROP POLICY IF EXISTS "Students can view own attempts" ON attempts;
DROP POLICY IF EXISTS "Teachers can view all attempts" ON attempts;
DROP POLICY IF EXISTS "Students can insert own attempts" ON attempts;
DROP POLICY IF EXISTS "Teachers can update attempts" ON attempts;
DROP POLICY IF EXISTS "Users can view own attempts" ON attempts;

-- Create new unified policies
CREATE POLICY "Users can view attempts"
  ON attempts FOR SELECT
  USING (
    auth.uid() = student_id -- Students can view their own attempts
    OR 
    EXISTS ( -- Teachers can view all attempts
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Students can only insert their own attempts
CREATE POLICY "Students can insert attempts"
  ON attempts FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Teachers can update any attempt
CREATE POLICY "Teachers can update attempts"
  ON attempts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );