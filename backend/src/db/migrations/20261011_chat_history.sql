-- Migration: 20261011_chat_history.sql
-- Chat history support: add updated_at, backfill, indexing, and trigger on messages insert.

ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE chat_threads t
SET updated_at = COALESCE(
  (SELECT MAX(m.created_at) FROM messages m WHERE m.thread_id = t.id),
  t.created_at,
  NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_student_updated ON chat_threads(student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_id, created_at);

-- Keeps updated_at current for EVERY insert path (chat, homework) with no route changes.
CREATE OR REPLACE FUNCTION touch_chat_thread() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE chat_threads SET updated_at = COALESCE(NEW.created_at, NOW()) WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_touch_chat_thread ON messages;
CREATE TRIGGER trg_touch_chat_thread AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION touch_chat_thread();
