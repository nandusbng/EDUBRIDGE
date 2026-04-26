-- Migration: Create Online Classes Table for Faculty Google Meet Sessions

CREATE TABLE IF NOT EXISTS online_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    class_date DATE NOT NULL,
    class_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    meet_link TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE online_classes ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Faculty can manage their own classes
CREATE POLICY "Faculty can insert their own classes"
ON online_classes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = faculty_id);

CREATE POLICY "Faculty can view their own classes"
ON online_classes FOR SELECT
TO authenticated
USING (auth.uid() = faculty_id);

CREATE POLICY "Faculty can delete their own classes"
ON online_classes FOR DELETE
TO authenticated
USING (auth.uid() = faculty_id);

-- 2. Students can view any class (or restrict if needed, but going with open viewing)
CREATE POLICY "Anyone authenticated can view classes"
ON online_classes FOR SELECT
TO authenticated
USING (true);
