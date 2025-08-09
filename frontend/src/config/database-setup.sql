-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create storage buckets
-- Note: Run this in Supabase dashboard Storage section
-- 1. Create 'videos' bucket with public access
-- 2. Create 'landmarks' bucket with public access

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('student', 'teacher');

-- Create user profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'student',
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create signs table
CREATE TABLE IF NOT EXISTS signs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gloss TEXT NOT NULL,
  exemplar_landmarks JSONB NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create attempts table
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES auth.users NOT NULL,
  sign_id UUID REFERENCES signs NOT NULL,
  score_shape REAL CHECK (score_shape BETWEEN 0 AND 100),
  score_location REAL CHECK (score_location BETWEEN 0 AND 100),
  score_movement REAL CHECK (score_movement BETWEEN 0 AND 100),
  total_score REAL GENERATED ALWAYS AS (
    (COALESCE(score_shape, 0) + COALESCE(score_location, 0) + COALESCE(score_movement, 0)) / 3
  ) STORED,
  heatmap JSONB,
  video_url TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create feedback table for teacher comments
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES attempts NOT NULL,
  teacher_id UUID REFERENCES auth.users NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create signs policies
CREATE POLICY "Anyone can view signs"
  ON signs FOR SELECT
  USING (true);

CREATE POLICY "Teachers can insert signs"
  ON signs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

CREATE POLICY "Teachers can update signs"
  ON signs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Create attempts policies
CREATE POLICY "Students can view own attempts"
  ON attempts FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view all attempts"
  ON attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

CREATE POLICY "Students can insert own attempts"
  ON attempts FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can update attempts"
  ON attempts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Create feedback policies
CREATE POLICY "Students can view feedback on own attempts"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attempts
      WHERE attempts.id = feedback.attempt_id
      AND attempts.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view all feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

CREATE POLICY "Teachers can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Create functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (new.id, 'student', new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create indexes
CREATE INDEX IF NOT EXISTS attempts_student_id_idx ON attempts(student_id);
CREATE INDEX IF NOT EXISTS attempts_sign_id_idx ON attempts(sign_id);
CREATE INDEX IF NOT EXISTS feedback_attempt_id_idx ON feedback(attempt_id);
CREATE INDEX IF NOT EXISTS signs_gloss_idx ON signs(gloss);
CREATE INDEX IF NOT EXISTS signs_tags_idx ON signs USING GIN(tags);

-- Update functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signs_updated_at
  BEFORE UPDATE ON signs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attempts_updated_at
  BEFORE UPDATE ON attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


