"""
Database models for ASL Vision Grader
"""

from sqlalchemy import Column, Float, ForeignKey, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

# Models will be implemented here
"""
CREATE TABLE signs (
  id UUID PRIMARY KEY,
  gloss TEXT,
  exemplar_landmarks JSONB   -- [[543 floats] x N frames]
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students,
  sign_id UUID REFERENCES signs,
  score_shape REAL,
  score_location REAL,
  score_movement REAL,
  heatmap JSONB,
  video_url TEXT,
  created_at TIMESTAMPTZ
);
"""