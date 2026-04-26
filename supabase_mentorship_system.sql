-- ==============================================================================
-- DATABASE MIGRATION: MENTORSHIP ECOSYSTEM
-- Creates the required tables and security rules for peer-mentorship.
-- Includes: Mentorship Requests and Automated Cohort Chat Rooms.
-- ==============================================================================

-- 1. Mentorship Requests Table
CREATE TABLE IF NOT EXISTS mentorship_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(mentee_id, mentor_id) -- Prevent duplicate requests
);

-- Enable RLS for Requests
ALTER TABLE mentorship_requests ENABLE ROW LEVEL SECURITY;

-- Students can create requests and view their own
CREATE POLICY "Students can create mentor requests"
ON mentorship_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = mentee_id);

CREATE POLICY "Users can view their own requests (mentee or mentor)"
ON mentorship_requests FOR SELECT TO authenticated
USING (auth.uid() = mentee_id OR auth.uid() = mentor_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('faculty', 'admin')));

-- Mentors can update (accept/reject) requests directed to them
CREATE POLICY "Mentors can update incoming requests"
ON mentorship_requests FOR UPDATE TO authenticated
USING (auth.uid() = mentor_id)
WITH CHECK (auth.uid() = mentor_id);


-- 2. Cohort Group Chats Table
CREATE TABLE IF NOT EXISTS cohort_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cohort_chats ENABLE ROW LEVEL SECURITY;

-- Reading Messages: Mentors, approved Mentees, Faculty, and Admins can read.
CREATE POLICY "Members and Faculty can view cohort chats"
ON cohort_chats FOR SELECT TO authenticated
USING (
    auth.uid() = mentor_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('faculty', 'admin')) OR 
    EXISTS (SELECT 1 FROM mentorship_requests WHERE mentee_id = auth.uid() AND mentor_id = cohort_chats.mentor_id AND status = 'accepted')
);

-- Sending Messages: Mentors and their approved Mentees can send messages.
CREATE POLICY "Approved members can send messages"
ON cohort_chats FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = sender_id AND (
        auth.uid() = mentor_id OR 
        EXISTS (SELECT 1 FROM mentorship_requests WHERE mentee_id = auth.uid() AND mentor_id = cohort_chats.mentor_id AND status = 'accepted')
    )
);
