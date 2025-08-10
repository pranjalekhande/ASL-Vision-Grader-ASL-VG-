-- Migration: Create analytics views and functions
-- This creates comprehensive analytics for teacher insights

-- 1. Student progress analytics view
CREATE OR REPLACE VIEW student_progress_analytics AS
SELECT 
    p.id as student_id,
    p.full_name as student_name,
    p.institution,
    p.created_at as enrolled_date,
    
    -- Overall statistics
    COUNT(a.id) as total_attempts,
    COUNT(DISTINCT a.sign_id) as unique_signs_practiced,
    
    -- Score averages (only for attempts with all scores)
    ROUND(AVG(CASE 
        WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END), 2) as overall_avg_score,
    
    ROUND(AVG(a.score_shape), 2) as avg_shape_score,
    ROUND(AVG(a.score_location), 2) as avg_location_score,
    ROUND(AVG(a.score_movement), 2) as avg_movement_score,
    
    -- Progress tracking
    MIN(a.created_at) as first_attempt,
    MAX(a.created_at) as last_attempt,
    
    -- Recent performance (last 7 days)
    COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as attempts_last_7_days,
    ROUND(AVG(CASE 
        WHEN a.created_at >= NOW() - INTERVAL '7 days' 
            AND a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END), 2) as avg_score_last_7_days,
    
    -- Improvement metrics
    ROUND(AVG(CASE 
        WHEN a.created_at >= NOW() - INTERVAL '7 days' 
            AND a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END) - AVG(CASE 
        WHEN a.created_at < NOW() - INTERVAL '7 days' 
            AND a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END), 2) as score_improvement_trend,
    
    -- Feedback statistics
    COUNT(f.id) as total_feedback_received,
    COUNT(CASE WHEN f.severity = 'high' THEN 1 END) as high_priority_feedback,
    
    -- Achievement levels
    COUNT(CASE 
        WHEN a.score_shape >= 80 AND a.score_location >= 80 AND a.score_movement >= 80 
        THEN 1 
    END) as excellent_attempts,
    
    COUNT(CASE 
        WHEN a.score_shape >= 60 AND a.score_location >= 60 AND a.score_movement >= 60 
            AND NOT (a.score_shape >= 80 AND a.score_location >= 80 AND a.score_movement >= 80)
        THEN 1 
    END) as good_attempts,
    
    -- Activity pattern
    EXTRACT(DOW FROM a.created_at) as most_active_day_of_week,
    EXTRACT(HOUR FROM a.created_at) as most_active_hour
    
FROM profiles p
LEFT JOIN attempts a ON a.student_id = p.id
LEFT JOIN feedback f ON f.attempt_id = a.id
WHERE p.role = 'student'
GROUP BY p.id, p.full_name, p.institution, p.created_at;

-- 2. Sign difficulty analytics view
CREATE OR REPLACE VIEW sign_difficulty_analytics AS
SELECT 
    s.id as sign_id,
    s.name as sign_name,
    
    -- Attempt statistics
    COUNT(a.id) as total_attempts,
    COUNT(DISTINCT a.student_id) as unique_students,
    
    -- Score statistics
    ROUND(AVG(CASE 
        WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END), 2) as avg_overall_score,
    
    ROUND(AVG(a.score_shape), 2) as avg_shape_score,
    ROUND(AVG(a.score_location), 2) as avg_location_score,
    ROUND(AVG(a.score_movement), 2) as avg_movement_score,
    
    -- Difficulty indicators
    ROUND(STDDEV(CASE 
        WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END), 2) as score_variance,
    
    -- Success rates
    ROUND(100.0 * COUNT(CASE 
        WHEN a.score_shape >= 80 AND a.score_location >= 80 AND a.score_movement >= 80 
        THEN 1 
    END) / NULLIF(COUNT(CASE 
        WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN 1 
    END), 0), 2) as success_rate,
    
    -- Feedback patterns
    COUNT(f.id) as total_feedback_given,
    COUNT(CASE WHEN f.category = 'shape' THEN 1 END) as shape_feedback_count,
    COUNT(CASE WHEN f.category = 'location' THEN 1 END) as location_feedback_count,
    COUNT(CASE WHEN f.category = 'movement' THEN 1 END) as movement_feedback_count,
    
    -- Learning curve (average attempts to achieve good score)
    ROUND(AVG(attempt_rank), 2) as avg_attempts_to_success,
    
    -- Time to mastery
    ROUND(AVG(EXTRACT(EPOCH FROM (
        SELECT MIN(a2.created_at) 
        FROM attempts a2 
        WHERE a2.student_id = a.student_id 
            AND a2.sign_id = a.sign_id
            AND a2.score_shape >= 80 
            AND a2.score_location >= 80 
            AND a2.score_movement >= 80
    )) - EXTRACT(EPOCH FROM (
        SELECT MIN(a3.created_at) 
        FROM attempts a3 
        WHERE a3.student_id = a.student_id 
            AND a3.sign_id = a.sign_id
    ))) / 86400, 2) as avg_days_to_mastery

FROM signs s
LEFT JOIN attempts a ON a.sign_id = s.id
LEFT JOIN feedback f ON f.attempt_id = a.id
LEFT JOIN (
    SELECT 
        student_id,
        sign_id,
        ROW_NUMBER() OVER (PARTITION BY student_id, sign_id ORDER BY created_at) as attempt_rank
    FROM attempts
    WHERE score_shape >= 80 AND score_location >= 80 AND score_movement >= 80
) success_attempts ON success_attempts.student_id = a.student_id AND success_attempts.sign_id = a.sign_id
GROUP BY s.id, s.name;

-- 3. Weekly progress view
CREATE OR REPLACE VIEW weekly_progress_summary AS
SELECT 
    DATE_TRUNC('week', a.created_at) as week_start,
    COUNT(a.id) as total_attempts,
    COUNT(DISTINCT a.student_id) as active_students,
    COUNT(DISTINCT a.sign_id) as signs_practiced,
    
    ROUND(AVG(CASE 
        WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END), 2) as avg_score,
    
    COUNT(CASE 
        WHEN a.score_shape >= 80 AND a.score_location >= 80 AND a.score_movement >= 80 
        THEN 1 
    END) as excellent_attempts,
    
    COUNT(f.id) as feedback_given
    
FROM attempts a
LEFT JOIN feedback f ON f.attempt_id = a.id
WHERE a.created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', a.created_at)
ORDER BY week_start DESC;

-- 4. Teacher performance analytics
CREATE OR REPLACE VIEW teacher_analytics AS
SELECT 
    p.id as teacher_id,
    p.full_name as teacher_name,
    
    -- Feedback statistics
    COUNT(f.id) as total_feedback_given,
    COUNT(DISTINCT f.attempt_id) as attempts_reviewed,
    ROUND(AVG(LENGTH(f.content)), 0) as avg_feedback_length,
    
    -- Feedback distribution
    COUNT(CASE WHEN f.category = 'shape' THEN 1 END) as shape_feedback,
    COUNT(CASE WHEN f.category = 'location' THEN 1 END) as location_feedback,
    COUNT(CASE WHEN f.category = 'movement' THEN 1 END) as movement_feedback,
    COUNT(CASE WHEN f.category = 'general' THEN 1 END) as general_feedback,
    
    -- Response time
    ROUND(AVG(EXTRACT(EPOCH FROM (f.created_at - a.created_at)) / 3600), 2) as avg_response_time_hours,
    
    -- Student impact
    COUNT(DISTINCT a.student_id) as students_helped,
    
    -- Template usage
    COUNT(ft.id) as templates_created,
    COALESCE(SUM(ft.usage_count), 0) as template_usage_total
    
FROM profiles p
LEFT JOIN feedback f ON f.teacher_id = p.id
LEFT JOIN attempts a ON a.id = f.attempt_id
LEFT JOIN feedback_templates ft ON ft.teacher_id = p.id
WHERE p.role = 'teacher'
GROUP BY p.id, p.full_name;

-- 5. Create functions for common analytics queries

-- Function to get student improvement over time
CREATE OR REPLACE FUNCTION get_student_improvement_timeline(student_uuid UUID, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    date_group DATE,
    attempts_count BIGINT,
    avg_score NUMERIC,
    best_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.created_at::DATE as date_group,
        COUNT(a.id) as attempts_count,
        ROUND(AVG(CASE 
            WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
            THEN (a.score_shape + a.score_location + a.score_movement) / 3 
        END), 2) as avg_score,
        ROUND(MAX(CASE 
            WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
            THEN (a.score_shape + a.score_location + a.score_movement) / 3 
        END), 2) as best_score
    FROM attempts a
    WHERE a.student_id = student_uuid
        AND a.created_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY a.created_at::DATE
    ORDER BY date_group;
END;
$$ LANGUAGE plpgsql;

-- Function to get sign mastery progression
CREATE OR REPLACE FUNCTION get_sign_mastery_progression(student_uuid UUID, sign_uuid UUID)
RETURNS TABLE (
    attempt_number BIGINT,
    created_at TIMESTAMPTZ,
    overall_score NUMERIC,
    shape_score NUMERIC,
    location_score NUMERIC,
    movement_score NUMERIC,
    feedback_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY a.created_at) as attempt_number,
        a.created_at,
        ROUND((a.score_shape + a.score_location + a.score_movement) / 3, 2) as overall_score,
        a.score_shape as shape_score,
        a.score_location as location_score,
        a.score_movement as movement_score,
        COUNT(f.id) as feedback_count
    FROM attempts a
    LEFT JOIN feedback f ON f.attempt_id = a.id
    WHERE a.student_id = student_uuid 
        AND a.sign_id = sign_uuid
        AND a.score_shape IS NOT NULL 
        AND a.score_location IS NOT NULL 
        AND a.score_movement IS NOT NULL
    GROUP BY a.id, a.created_at, a.score_shape, a.score_location, a.score_movement
    ORDER BY a.created_at;
END;
$$ LANGUAGE plpgsql;

-- 6. Grant permissions on all views and functions
GRANT SELECT ON student_progress_analytics TO authenticated;
GRANT SELECT ON sign_difficulty_analytics TO authenticated;
GRANT SELECT ON weekly_progress_summary TO authenticated;
GRANT SELECT ON teacher_analytics TO authenticated;

GRANT EXECUTE ON FUNCTION get_student_improvement_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION get_sign_mastery_progression TO authenticated;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attempts_created_at_week ON attempts (DATE_TRUNC('week', created_at));
CREATE INDEX IF NOT EXISTS idx_attempts_student_sign_created ON attempts (student_id, sign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);

-- 8. Create materialized view for dashboard summary (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_summary AS
SELECT 
    'overview' as metric_type,
    COUNT(DISTINCT s.id) as total_students,
    COUNT(DISTINCT sg.id) as total_signs,
    COUNT(a.id) as total_attempts,
    COUNT(f.id) as total_feedback,
    ROUND(AVG(CASE 
        WHEN a.score_shape IS NOT NULL AND a.score_location IS NOT NULL AND a.score_movement IS NOT NULL 
        THEN (a.score_shape + a.score_location + a.score_movement) / 3 
    END), 2) as overall_avg_score,
    COUNT(CASE 
        WHEN a.created_at >= NOW() - INTERVAL '7 days' 
        THEN 1 
    END) as attempts_last_week,
    COUNT(CASE 
        WHEN a.created_at >= NOW() - INTERVAL '7 days' 
            AND a.score_shape >= 80 AND a.score_location >= 80 AND a.score_movement >= 80 
        THEN 1 
    END) as excellent_attempts_last_week
FROM profiles s
CROSS JOIN signs sg
LEFT JOIN attempts a ON a.student_id = s.id
LEFT JOIN feedback f ON f.attempt_id = a.id
WHERE s.role = 'student';

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_summary_type ON dashboard_summary (metric_type);

-- Grant permissions
GRANT SELECT ON dashboard_summary TO authenticated;

-- Function to refresh dashboard summary (can be called by cron or trigger)
CREATE OR REPLACE FUNCTION refresh_dashboard_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_summary;
END;
$$ LANGUAGE plpgsql;
