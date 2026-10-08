-- Migration: Create thread_images table for decoupled homework image context lookup
CREATE TABLE IF NOT EXISTS thread_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on thread_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_thread_images_thread_id ON thread_images(thread_id);

-- Enable Row Level Security (RLS)
ALTER TABLE thread_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Students and parents can access thread_images for threads they own
CREATE POLICY "Users can manage thread images for their threads"
ON thread_images
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM chat_threads
    WHERE chat_threads.id = thread_images.thread_id
    AND chat_threads.student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
  )
);
