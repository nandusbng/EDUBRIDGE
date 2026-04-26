-- Run this in Supabase SQL Editor to create the increment function.
-- This allows the frontend to safely add time to a user's total without
-- risking race conditions or overwriting the cumulative value.

CREATE OR REPLACE FUNCTION increment_time_spent(user_id uuid, delta_ms bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users
  SET time_spent = COALESCE(time_spent, 0) + delta_ms
  WHERE id = user_id;
$$;
