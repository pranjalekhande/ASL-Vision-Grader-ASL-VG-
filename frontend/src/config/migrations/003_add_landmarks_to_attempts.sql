-- Add landmarks column to attempts table for storing student landmark data
-- This allows us to store the actual hand movement data for each attempt

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS landmarks JSONB;

-- Add index for efficient landmark queries (useful for analytics)
CREATE INDEX IF NOT EXISTS attempts_landmarks_idx ON attempts USING GIN(landmarks);

-- Add constraint to ensure landmarks is a valid JSON object when provided
ALTER TABLE attempts
  ADD CONSTRAINT valid_landmarks CHECK (landmarks IS NULL OR jsonb_typeof(landmarks) = 'object');

-- Update existing rows to have empty landmarks object (if any exist)
UPDATE attempts 
SET landmarks = '{"frames": []}'::jsonb 
WHERE landmarks IS NULL;
