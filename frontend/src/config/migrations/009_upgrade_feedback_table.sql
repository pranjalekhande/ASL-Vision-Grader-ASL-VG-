-- Migration: Upgrade existing feedback table to new enhanced schema
-- This migrates the old simple feedback table to support timestamped, categorized feedback

-- 1. Check if we need to migrate by looking at existing columns
DO $$ 
BEGIN
    -- If timestamp_seconds doesn't exist, we need to upgrade
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'feedback' 
        AND column_name = 'timestamp_seconds'
    ) THEN
        
        RAISE NOTICE 'Upgrading feedback table to enhanced schema...';
        
        -- Step 1: Add new columns to existing feedback table
        ALTER TABLE feedback 
        ADD COLUMN IF NOT EXISTS content TEXT,
        ADD COLUMN IF NOT EXISTS timestamp_seconds FLOAT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'general',
        ADD COLUMN IF NOT EXISTS severity VARCHAR(10) DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS area_coordinates JSONB;
        
        -- Step 2: Migrate existing data from 'comment' to 'content'
        UPDATE feedback 
        SET content = COALESCE(comment, 'Legacy feedback')
        WHERE content IS NULL;
        
        -- Step 3: Add constraints after data migration
        ALTER TABLE feedback 
        ALTER COLUMN content SET NOT NULL,
        ALTER COLUMN timestamp_seconds SET NOT NULL,
        ALTER COLUMN category SET NOT NULL,
        ALTER COLUMN severity SET NOT NULL;
        
        -- Step 4: Add check constraints (with existence check)
        -- Check and add timestamp constraint
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'feedback' AND constraint_name = 'feedback_timestamp_check'
        ) THEN
            ALTER TABLE feedback 
            ADD CONSTRAINT feedback_timestamp_check 
                CHECK (timestamp_seconds >= 0 AND timestamp_seconds <= 300);
        END IF;
        
        -- Check and add category constraint
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'feedback' AND constraint_name = 'feedback_category_check'
        ) THEN
            ALTER TABLE feedback 
            ADD CONSTRAINT feedback_category_check 
                CHECK (category IN ('shape', 'location', 'movement', 'general'));
        END IF;
        
        -- Check and add severity constraint
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'feedback' AND constraint_name = 'feedback_severity_check'
        ) THEN
            ALTER TABLE feedback 
            ADD CONSTRAINT feedback_severity_check 
                CHECK (severity IN ('low', 'medium', 'high'));
        END IF;
        
        -- Step 5: Drop old comment column (optional - keep for safety)
        -- ALTER TABLE feedback DROP COLUMN IF EXISTS comment;
        
        RAISE NOTICE 'Feedback table upgrade completed successfully!';
        
    ELSE
        RAISE NOTICE 'Feedback table already has enhanced schema - no migration needed.';
    END IF;
END $$;

-- 2. Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS feedback_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('shape', 'location', 'movement', 'general')),
    content TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(teacher_id, name)
);

CREATE TABLE IF NOT EXISTS feedback_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(feedback_id, student_id)
);

-- 3. Create indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_feedback_attempt_id ON feedback(attempt_id);
CREATE INDEX IF NOT EXISTS idx_feedback_teacher_id ON feedback(teacher_id);
CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback(timestamp_seconds);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_templates_teacher_id ON feedback_templates(teacher_id);
CREATE INDEX IF NOT EXISTS idx_feedback_notifications_student_id ON feedback_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_notifications_unread ON feedback_notifications(student_id, read_at) WHERE read_at IS NULL;

-- 4. Update/create RLS policies for enhanced feedback table
DROP POLICY IF EXISTS "Teachers can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Students can view feedback on own attempts" ON feedback;
DROP POLICY IF EXISTS "Teachers can insert feedback" ON feedback;

-- Enhanced feedback policies
CREATE POLICY "Teachers can view all feedback" ON feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
        )
    );

CREATE POLICY "Students can view feedback on own attempts" ON feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM attempts
            WHERE attempts.id = feedback.attempt_id
            AND attempts.student_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can insert feedback" ON feedback
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
        )
        AND teacher_id = auth.uid()
    );

CREATE POLICY "Teachers can update own feedback" ON feedback
    FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own feedback" ON feedback
    FOR DELETE USING (teacher_id = auth.uid());

-- 5. Enable RLS on new tables
ALTER TABLE feedback_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_notifications ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for new tables
CREATE POLICY "Teachers can manage own templates" ON feedback_templates
    FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students can view own notifications" ON feedback_notifications
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can update own notifications" ON feedback_notifications
    FOR UPDATE USING (student_id = auth.uid());

-- 7. Create helper function for template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE feedback_templates 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add updated_at triggers for new tables
CREATE TRIGGER update_feedback_templates_updated_at
    BEFORE UPDATE ON feedback_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Create helpful views
CREATE OR REPLACE VIEW feedback_with_details AS
SELECT 
    f.*,
    a.student_id,
    a.sign_id,
    a.score_shape,
    a.score_location,
    a.score_movement,
    s.gloss as sign_name,
    p_student.full_name as student_name,
    p_teacher.full_name as teacher_name
FROM feedback f
JOIN attempts a ON a.id = f.attempt_id
JOIN signs s ON s.id = a.sign_id
JOIN profiles p_student ON p_student.id = a.student_id
JOIN profiles p_teacher ON p_teacher.id = f.teacher_id;

-- Grant permissions on views
GRANT SELECT ON feedback_with_details TO authenticated;

-- 10. Verify the migration
DO $$
DECLARE
    feedback_columns TEXT[];
BEGIN
    SELECT array_agg(column_name) INTO feedback_columns
    FROM information_schema.columns 
    WHERE table_name = 'feedback';
    
    RAISE NOTICE 'Feedback table now has columns: %', array_to_string(feedback_columns, ', ');
    
    IF 'timestamp_seconds' = ANY(feedback_columns) AND 'category' = ANY(feedback_columns) THEN
        RAISE NOTICE '✅ Migration successful! Enhanced feedback system is ready.';
    ELSE
        RAISE WARNING '❌ Migration may have failed. Please check table structure.';
    END IF;
END $$;
