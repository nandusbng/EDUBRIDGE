-- ── ACADEMIC AUDIT HUB: EXTENDED SCHEMA (UPDATED) ──────────────────
-- Copy and run this in your Supabase SQL Editor to update your table.

-- 1. CLEANUP: Remove deprecated tracking fields
ALTER TABLE mentorship_doubt_sessions DROP COLUMN IF EXISTS mentee_semester;
ALTER TABLE mentorship_doubt_sessions DROP COLUMN IF EXISTS mentor_semester;
ALTER TABLE mentorship_doubt_sessions DROP COLUMN IF EXISTS assigned_faculty_name;

-- 2. ADD: Detailed Academic Snapshot Fields
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentee_faculty_advisor VARCHAR(255);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentor_faculty_advisor VARCHAR(255);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentee_email VARCHAR(255);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentor_email VARCHAR(255);

-- 3. ENSURE: User metadata columns exist in 'users'
ALTER TABLE users ADD COLUMN IF NOT EXISTS register_number VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS year VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS section VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS semester VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_faculty VARCHAR(255);

-- 4. SNAPSHOT COLUMNS (Verification of existing ones)
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentee_name VARCHAR(255);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentee_reg_no VARCHAR(50);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentee_branch VARCHAR(100);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentee_year VARCHAR(10);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentee_section VARCHAR(10);

ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentor_name VARCHAR(255);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentor_reg_no VARCHAR(50);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentor_branch VARCHAR(100);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentor_year VARCHAR(10);
ALTER TABLE mentorship_doubt_sessions ADD COLUMN IF NOT EXISTS mentor_section VARCHAR(10);

-- ── SCHEMA UPDATE COMPLETE ──
