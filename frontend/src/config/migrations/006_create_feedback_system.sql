-- Migration: Create feedback system
-- This creates tables and policies for the teacher feedback functionality

-- 1. Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp_seconds FLOAT NOT NULL CHECK (timestamp_seconds >= 0),
    category VARCHAR(20) NOT NULL CHECK (category IN ('shape', 'location', 'movement', 'general')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',
    area_coordinates JSONB, -- For marking specific areas in video
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure timestamp is within reasonable bounds
    CONSTRAINT valid_timestamp CHECK (timestamp_seconds <= 300) -- 5 minutes max
);

-- 2. Create feedback templates table
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

-- 3. Create notifications table for feedback
CREATE TABLE IF NOT EXISTS feedback_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(feedback_id, student_id)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_attempt_id ON feedback(attempt_id);
CREATE INDEX IF NOT EXISTS idx_feedback_teacher_id ON feedback(teacher_id);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback(timestamp_seconds);

CREATE INDEX IF NOT EXISTS idx_feedback_templates_teacher_id ON feedback_templates(teacher_id);
CREATE INDEX IF NOT EXISTS idx_feedback_templates_category ON feedback_templates(category);

CREATE INDEX IF NOT EXISTS idx_feedback_notifications_student_id ON feedback_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_notifications_read_at ON feedback_notifications(read_at);

-- 5. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create triggers for updated_at
CREATE TRIGGER update_feedback_updated_at 
    BEFORE UPDATE ON feedback 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_templates_updated_at 
    BEFORE UPDATE ON feedback_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Create RLS policies

-- Feedback policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Teachers can create, read, update, delete their own feedback
CREATE POLICY "Teachers can manage their own feedback" ON feedback
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'teacher'
        ) AND teacher_id = auth.uid()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'teacher'
        ) AND teacher_id = auth.uid()
    );

-- Students can read feedback on their own attempts
CREATE POLICY "Students can read feedback on their attempts" ON feedback
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM attempts a
            JOIN profiles p ON p.id = auth.uid()
            WHERE a.id = feedback.attempt_id 
            AND a.student_id = auth.uid()
            AND p.role = 'student'
        )
    );

-- Feedback templates policies
ALTER TABLE feedback_templates ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own templates
CREATE POLICY "Teachers can manage their own templates" ON feedback_templates
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'teacher'
        ) AND teacher_id = auth.uid()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'teacher'
        ) AND teacher_id = auth.uid()
    );

-- Feedback notifications policies
ALTER TABLE feedback_notifications ENABLE ROW LEVEL SECURITY;

-- Students can read their own notifications
CREATE POLICY "Students can read their own notifications" ON feedback_notifications
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'student'
        ) AND student_id = auth.uid()
    );

-- Students can update their own notifications (mark as read)
CREATE POLICY "Students can update their own notifications" ON feedback_notifications
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'student'
        ) AND student_id = auth.uid()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'student'
        ) AND student_id = auth.uid()
    );

-- Teachers can create notifications for feedback they created
CREATE POLICY "Teachers can create notifications for their feedback" ON feedback_notifications
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM feedback f
            JOIN profiles p ON p.id = auth.uid()
            WHERE f.id = feedback_id 
            AND f.teacher_id = auth.uid()
            AND p.role = 'teacher'
        )
    );

-- 8. Create function to automatically create notifications when feedback is added
CREATE OR REPLACE FUNCTION create_feedback_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Get the student_id from the attempt
    INSERT INTO feedback_notifications (feedback_id, student_id)
    SELECT NEW.id, a.student_id
    FROM attempts a
    WHERE a.id = NEW.attempt_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to automatically create notifications
CREATE TRIGGER create_feedback_notification_trigger
    AFTER INSERT ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION create_feedback_notification();

-- 10. Create helpful views

-- View for feedback with attempt details
CREATE OR REPLACE VIEW feedback_with_details AS
SELECT 
    f.*,
    a.student_id,
    a.sign_id,
    a.score_shape,
    a.score_location,
    a.score_movement,
    s.name as sign_name,
    p_student.full_name as student_name,
    p_teacher.full_name as teacher_name
FROM feedback f
JOIN attempts a ON a.id = f.attempt_id
JOIN signs s ON s.id = a.sign_id
JOIN profiles p_student ON p_student.id = a.student_id
JOIN profiles p_teacher ON p_teacher.id = f.teacher_id;

-- View for student notification counts
CREATE OR REPLACE VIEW student_notification_summary AS
SELECT 
    student_id,
    COUNT(*) as total_notifications,
    COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count,
    MAX(fn.created_at) as latest_notification
FROM feedback_notifications fn
GROUP BY student_id;

-- Grant permissions on views
GRANT SELECT ON feedback_with_details TO authenticated;
GRANT SELECT ON student_notification_summary TO authenticated;

-- 11. Sample feedback templates (optional - can be inserted via application)
INSERT INTO feedback_templates (teacher_id, name, category, content, severity) 
VALUES 
    ((SELECT id FROM profiles WHERE role = 'teacher' LIMIT 1), 'Hand Shape Correction', 'shape', 'Focus on forming a more precise hand shape. Your fingers should be more curved/straight.', 'medium'),
    ((SELECT id FROM profiles WHERE role = 'teacher' LIMIT 1), 'Location Adjustment', 'location', 'Move your hand slightly higher/lower to match the correct signing space.', 'medium'),
    ((SELECT id FROM profiles WHERE role = 'teacher' LIMIT 1), 'Movement Speed', 'movement', 'Try to slow down your movement to match the reference timing.', 'low'),
    ((SELECT id FROM profiles WHERE role = 'teacher' LIMIT 1), 'Excellent Form', 'general', 'Great job! Your form matches the exemplar very well.', 'low')
ON CONFLICT (teacher_id, name) DO NOTHING;
