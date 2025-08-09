-- Create sign difficulty enum
CREATE TYPE sign_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');

-- Create sign category enum
CREATE TYPE sign_category AS ENUM (
  'alphabet',
  'numbers',
  'common_phrases',
  'greetings',
  'emotions',
  'colors',
  'time',
  'family',
  'food',
  'animals',
  'weather',
  'other'
);

-- Create sign status enum
CREATE TYPE sign_status AS ENUM ('draft', 'published', 'archived');

-- Update signs table
ALTER TABLE signs
  -- Drop old columns
  DROP COLUMN difficulty,
  -- Add new columns
  ADD COLUMN name TEXT NOT NULL,
  ADD COLUMN description TEXT,
  ADD COLUMN difficulty sign_difficulty NOT NULL DEFAULT 'beginner',
  ADD COLUMN category sign_category NOT NULL DEFAULT 'other',
  ADD COLUMN status sign_status NOT NULL DEFAULT 'draft',
  ADD COLUMN video_url TEXT,
  ADD COLUMN thumbnail_url TEXT,
  -- Rename gloss to name (already added new name column)
  DROP COLUMN gloss,
  -- Rename exemplar_landmarks to landmarks
  RENAME COLUMN exemplar_landmarks TO landmarks;

-- Create index on new columns
CREATE INDEX IF NOT EXISTS signs_name_idx ON signs(name);
CREATE INDEX IF NOT EXISTS signs_category_idx ON signs(category);
CREATE INDEX IF NOT EXISTS signs_difficulty_idx ON signs(difficulty);
CREATE INDEX IF NOT EXISTS signs_status_idx ON signs(status);


