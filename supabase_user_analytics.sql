-- ============================================================================
-- EduBridge: user_analytics table
-- Run this entire script in the Supabase SQL Editor.
-- ============================================================================

-- 1. Create the dedicated analytics table
CREATE TABLE IF NOT EXISTS user_analytics (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name         text,
    student_email        text,
    student_class        text,
    register_number      text,
    time_spent           bigint  NOT NULL DEFAULT 0,  -- cumulative minutes
    notes_viewed         int     NOT NULL DEFAULT 0,
    notes_downloaded     int     NOT NULL DEFAULT 0,
    assignments_submitted int    NOT NULL DEFAULT 0,
    quizzes_started      int     NOT NULL DEFAULT 0,
    notes_added          int     NOT NULL DEFAULT 0,  -- faculty uploads
    subjects_added       int     NOT NULL DEFAULT 0,  -- faculty subject additions
    last_ping            timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_analytics_user_id_key UNIQUE (user_id)
);

-- 2. Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_analytics_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS analytics_updated_at ON user_analytics;
CREATE TRIGGER analytics_updated_at
    BEFORE UPDATE ON user_analytics
    FOR EACH ROW EXECUTE FUNCTION update_analytics_timestamp();

-- 3. Auto-create an analytics row when a new user is registered
CREATE OR REPLACE FUNCTION create_user_analytics()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO user_analytics (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_analytics ON users;
CREATE TRIGGER on_user_created_analytics
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_analytics();

-- 4. Backfill analytics rows for all existing users (safe, no overwrite)
INSERT INTO user_analytics (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- 5. Upsert function — safe atomic increment for time_spent
--    Called by the frontend every 60 seconds with the delta full minutes for that period.
DROP FUNCTION IF EXISTS upsert_user_analytics(uuid, bigint, int, int, int, int);
DROP FUNCTION IF EXISTS upsert_user_analytics(uuid, bigint, int, int, int, int, text, text, text, text);

CREATE OR REPLACE FUNCTION upsert_user_analytics(
    p_user_id              uuid,
    p_delta_minutes        bigint,
    p_notes_viewed         int,
    p_notes_downloaded     int,
    p_assignments_submitted int,
    p_quizzes_started      int,
    p_student_name         text DEFAULT NULL,
    p_student_email        text DEFAULT NULL,
    p_student_class        text DEFAULT NULL,
    p_register_number      text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO user_analytics (
        user_id, time_spent, notes_viewed, notes_downloaded,
        assignments_submitted, quizzes_started, last_ping,
        student_name, student_email, student_class, register_number
    )
    VALUES (
        p_user_id, p_delta_minutes, p_notes_viewed, p_notes_downloaded,
        p_assignments_submitted, p_quizzes_started, now(),
        p_student_name, p_student_email, p_student_class, p_register_number
    )
    ON CONFLICT (user_id) DO UPDATE SET
        time_spent            = user_analytics.time_spent + p_delta_minutes,
        notes_viewed          = GREATEST(user_analytics.notes_viewed,          p_notes_viewed),
        notes_downloaded      = GREATEST(user_analytics.notes_downloaded,      p_notes_downloaded),
        assignments_submitted = GREATEST(user_analytics.assignments_submitted, p_assignments_submitted),
        quizzes_started       = GREATEST(user_analytics.quizzes_started,       p_quizzes_started),
        student_name          = COALESCE(p_student_name, user_analytics.student_name),
        student_email         = COALESCE(p_student_email, user_analytics.student_email),
        student_class         = COALESCE(p_student_class, user_analytics.student_class),
        register_number       = COALESCE(p_register_number, user_analytics.register_number),
        last_ping             = now(),
        updated_at            = now();
END;
$$;

-- 6. Separate function for faculty to increment notes_added / subjects_added
CREATE OR REPLACE FUNCTION increment_faculty_analytics(
    p_user_id       uuid,
    p_notes_added   int DEFAULT 0,
    p_subjects_added int DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO user_analytics (user_id, notes_added, subjects_added)
    VALUES (p_user_id, p_notes_added, p_subjects_added)
    ON CONFLICT (user_id) DO UPDATE SET
        notes_added    = user_analytics.notes_added    + p_notes_added,
        subjects_added = user_analytics.subjects_added + p_subjects_added,
        updated_at     = now();
END;
$$;

-- 7. Row Level Security
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own row
DROP POLICY IF EXISTS "Users can manage own analytics" ON user_analytics;
CREATE POLICY "Users can manage own analytics"
    ON user_analytics FOR ALL
    USING (auth.uid() = user_id);

-- Faculty, Admin, Mentor can READ all rows (for analytics dashboards)
DROP POLICY IF EXISTS "Staff can view all analytics" ON user_analytics;
CREATE POLICY "Staff can view all analytics"
    ON user_analytics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
              AND users.role IN ('faculty', 'admin', 'mentor')
        )
    );

-- Allow the DEFINER functions to bypass RLS
ALTER FUNCTION upsert_user_analytics SECURITY DEFINER;
ALTER FUNCTION increment_faculty_analytics SECURITY DEFINER;
