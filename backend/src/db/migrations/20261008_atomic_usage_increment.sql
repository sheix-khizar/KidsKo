-- Migration: 20261008_atomic_usage_increment.sql
-- Description: Creates atomic Postgres RPC function for family weekly usage limits
-- Prevents race conditions and guarantees thread-safe, concurrency-safe limit enforcement.

CREATE OR REPLACE FUNCTION increment_weekly_usage(
  p_parent_id UUID,
  p_type TEXT,
  p_limit INT
) RETURNS JSONB AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_usage RECORD;
  v_is_new_week BOOLEAN;
  v_current_count INT;
  v_new_count INT;
BEGIN
  -- 1. Ensure row exists and acquire exclusive row lock (FOR UPDATE)
  SELECT * INTO v_usage
  FROM family_usage
  WHERE parent_id = p_parent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO family_usage (parent_id, daily_message_count, daily_scan_count, weekly_voice_minutes_used, last_weekly_reset_at)
    VALUES (p_parent_id, 0, 0, 0, v_now)
    RETURNING * INTO v_usage;
  END IF;

  -- 2. Lazy weekly reset check (7+ days elapsed)
  v_is_new_week := (v_now - COALESCE(v_usage.last_weekly_reset_at, '1970-01-01'::timestamptz)) >= INTERVAL '7 days';

  IF v_is_new_week THEN
    UPDATE family_usage
    SET daily_message_count = 0,
        daily_scan_count = 0,
        weekly_voice_minutes_used = 0,
        last_weekly_reset_at = v_now
    WHERE parent_id = p_parent_id;
    
    v_usage.daily_message_count := 0;
    v_usage.daily_scan_count := 0;
    v_usage.last_weekly_reset_at := v_now;
  END IF;

  -- 3. Determine current counter
  IF p_type = 'message' THEN
    v_current_count := COALESCE(v_usage.daily_message_count, 0);
  ELSIF p_type = 'scan' THEN
    v_current_count := COALESCE(v_usage.daily_scan_count, 0);
  ELSE
    RAISE EXCEPTION 'Invalid usage type: %. Must be "message" or "scan".', p_type;
  END IF;

  -- 4. Check if limit is already reached
  IF v_current_count >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'current', v_current_count
    );
  END IF;

  -- 5. Atomically increment
  v_new_count := v_current_count + 1;
  IF p_type = 'message' THEN
    UPDATE family_usage
    SET daily_message_count = v_new_count
    WHERE parent_id = p_parent_id;
  ELSE
    UPDATE family_usage
    SET daily_scan_count = v_new_count
    WHERE parent_id = p_parent_id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(0, p_limit - v_new_count),
    'current', v_new_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
