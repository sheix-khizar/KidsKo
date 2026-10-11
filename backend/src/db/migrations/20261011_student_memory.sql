-- Migration: 20261011_student_memory.sql
-- Child memory support: student_memory table, RLS policies, and usage_events constraint extension.

CREATE TABLE IF NOT EXISTS student_memory (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  preferred_name TEXT,
  facts TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent owns student_memory" ON student_memory;
CREATE POLICY "parent owns student_memory" ON student_memory
FOR ALL
USING (student_id IN (SELECT id FROM students WHERE parent_id = auth.uid()))
WITH CHECK (student_id IN (SELECT id FROM students WHERE parent_id = auth.uid()));

-- Allow cost tracking for memory extraction. Verify the real constraint name first (\d usage_events).
ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_event_type_check;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_event_type_check
  CHECK (event_type IN ('message','scan','cache_hit','live_snapshot','voice_trial','memory'));
