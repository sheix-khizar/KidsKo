-- Migration: Family-Pooled Usage Counters & Event Tracking Schema
-- 1. Family Usage Pooling Table
CREATE TABLE IF NOT EXISTS family_usage (
  parent_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  daily_message_count INT DEFAULT 0,
  daily_scan_count INT DEFAULT 0,
  last_daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  weekly_voice_minutes_used NUMERIC(10,2) DEFAULT 0,
  weekly_live_snapshots_used INT DEFAULT 0,
  last_weekly_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only the owning parent (and service role) can access their family usage row
ALTER TABLE family_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent owns their family_usage row" ON family_usage
  FOR ALL USING (auth.uid() = parent_id);

-- 2. Usage Events Analytics Table
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  event_type TEXT CHECK (event_type IN ('message','scan','cache_hit','live_snapshot','voice_trial')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent owns their usage_events rows" ON usage_events
  FOR ALL USING (auth.uid() = parent_id);
