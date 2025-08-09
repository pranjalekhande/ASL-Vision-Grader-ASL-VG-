-- Update signs table with new fields
ALTER TABLE signs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS common_mistakes JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Rename gloss to name for clarity
ALTER TABLE signs RENAME COLUMN gloss TO name;

-- Add constraints
ALTER TABLE signs
  ALTER COLUMN difficulty SET NOT NULL,
  ADD CONSTRAINT difficulty_range CHECK (difficulty BETWEEN 1 AND 5),
  ADD CONSTRAINT name_not_empty CHECK (name != ''),
  ADD CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object'),
  ADD CONSTRAINT valid_common_mistakes CHECK (jsonb_typeof(common_mistakes) = 'object');

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS signs_name_idx ON signs(name);

-- Update existing rows with default values
UPDATE signs SET
  description = COALESCE(description, ''),
  common_mistakes = COALESCE(common_mistakes, '{}'),
  metadata = COALESCE(metadata, '{}')
WHERE description IS NULL
   OR common_mistakes IS NULL
   OR metadata IS NULL;


