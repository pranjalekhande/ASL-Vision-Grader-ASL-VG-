-- Allow students to update their own attempts (for video_url after upload)
CREATE POLICY "Students can update own attempts"
  ON attempts FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);
