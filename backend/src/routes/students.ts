import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getMemory, filterFact, filterPreferredName } from '../lib/studentMemory';
import { supabaseAdmin } from '../lib/supabase';
import { deleteThreadImagesFromStorage } from '../lib/homeworkStorage';

const router = Router();

function isTableMissingError(error: any): boolean {
  if (!error) return false;
  // Strictly match PostgreSQL '42P01' (undefined_table) or PostgREST 'PGRST205' (table not in schema cache)
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  if (typeof error.message === 'string') {
    return (
      error.message.includes('Could not find the table') ||
      /relation "[^"]+" does not exist/i.test(error.message)
    );
  }
  return false;
}

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { student_name } = req.body;

  if (!student_name) {
    return res.status(400).json({ error: 'student_name is required' });
  }

  const { data, error } = await req.supabase!
    .from('students')
    .insert({ parent_id: req.user!.id, student_name })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ student: data });
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { data, error } = await req.supabase!.from('students').select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ students: data });
});

// GET /api/students/:id/memory (Step 9.5 / 4.5)
router.get('/:id/memory', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;

  // Defense-in-depth ownership check (identical pattern to transcript.ts)
  const { data: student, error: studentError } = await req.supabase!
    .from('students')
    .select('id, student_name')
    .eq('id', id)
    .eq('parent_id', req.user!.id)
    .maybeSingle();

  if (studentError || !student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const memory = await getMemory(req.supabase!, id);

  return res.status(200).json({
    studentId: id,
    studentName: student.student_name,
    preferredName: memory.preferredName,
    facts: memory.facts,
    enabled: memory.enabled,
  });
});

// GET /api/students/:id/activity (Real Learning Analytics per child)
router.get('/:id/activity', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Verify parent ownership
  const { data: student, error: studentError } = await req.supabase!
    .from('students')
    .select('id, student_name')
    .eq('id', id)
    .eq('parent_id', req.user!.id)
    .maybeSingle();

  if (studentError || !student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  // 2. Fetch threads and user messages count
  const { data: threads } = await req.supabase!
    .from('chat_threads')
    .select('id, title, created_at')
    .eq('student_id', id);

  const threadIds = (threads || []).map((t: any) => t.id);

  let userMessages: { content?: string; created_at: string }[] = [];
  const { data: msgs } = await req.supabase!
    .from('messages')
    .select('content, created_at')
    .eq('student_id', id)
    .eq('role', 'user');
  userMessages = msgs || [];

  // 3. Calculate real metrics
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const questionsToday = userMessages.filter(
    (m) => new Date(m.created_at).getTime() >= startOfToday
  ).length;

  const weekMessages = userMessages.filter(
    (m) => new Date(m.created_at).getTime() >= sevenDaysAgo
  );

  const questionsThisWeek = weekMessages.length;
  const topicsExplored = threadIds.length;

  // Real Subject Categorization
  let scienceCount = 0;
  let mathsCount = 0;
  let englishCount = 0;
  let otherCount = 0;

  const scienceRegex = /\b(science|planet|solar|space|star|earth|moon|animal|plant|biology|chemistry|physics|body|cell|water|energy|light|sound|weather|dinosaur|dinasour|volcano|gravity|magnet|nature|experiment)\b/i;
  const mathsRegex = /\b(math|maths|mathematics|number|numbers|add|addition|subtract|subtraction|multiply|multiplication|divide|division|fraction|fractions|decimal|algebra|geometry|shape|shapes|count|calculate|equation|sum|plus|minus|perimeter|area|angle)\b/i;
  const englishRegex = /\b(english|word|words|spelling|spell|read|reading|write|writing|sentence|grammar|noun|verb|adjective|adverb|punctuation|poem|poetry|story|book|author|letter|vocabulary|paragraph|essay)\b/i;

  weekMessages.forEach((m) => {
    const text = (m.content || '').toLowerCase();
    if (mathsRegex.test(text)) {
      mathsCount++;
    } else if (scienceRegex.test(text)) {
      scienceCount++;
    } else if (englishRegex.test(text)) {
      englishCount++;
    } else {
      otherCount++;
    }
  });

  const topics: { name: string; icon: string; count: number; color: string }[] = [];
  if (scienceCount > 0) {
    topics.push({ name: 'Science', icon: '🔬', count: scienceCount, color: '#FF6B6B' });
  }
  if (mathsCount > 0) {
    topics.push({ name: 'Maths', icon: '🔢', count: mathsCount, color: '#FF9F43' });
  }
  if (englishCount > 0) {
    topics.push({ name: 'English', icon: '📖', count: englishCount, color: '#2ECC71' });
  }
  if (otherCount > 0) {
    topics.push({ name: 'General Learning', icon: '💡', count: otherCount, color: '#9B51E0' });
  }

  // Day of week counts (Mon..Sun)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyCounts: Record<string, number> = {
    Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0,
  };

  userMessages.forEach((m) => {
    const d = new Date(m.created_at);
    if (d.getTime() >= sevenDaysAgo) {
      const dayName = daysOfWeek[d.getDay()];
      dailyCounts[dayName] = (dailyCounts[dayName] || 0) + 1;
    }
  });

  // Calculate real day streak
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const dayStart = startOfToday - i * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const hasActivity = userMessages.some((m) => {
      const t = new Date(m.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
    if (hasActivity) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Real total stars earned: 5 stars per question + 10 stars per topic + 15 stars per streak day
  const totalStars = Math.max(25, (userMessages.length * 5) + (topicsExplored * 10) + (streak * 15));

  return res.status(200).json({
    studentId: id,
    studentName: student.student_name,
    questionsToday,
    questionsThisWeek,
    topicsExplored,
    streak,
    stars: totalStars,
    dailyCounts,
    topics,
  });
});

// PUT /api/students/:id/memory (Step 9.5 / 4.5)
router.put('/:id/memory', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data: student, error: studentError } = await req.supabase!
    .from('students')
    .select('id, student_name')
    .eq('id', id)
    .eq('parent_id', req.user!.id)
    .maybeSingle();

  if (studentError || !student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const current = await getMemory(req.supabase!, id);

  const enabled = typeof req.body.enabled === 'boolean' ? req.body.enabled : current.enabled;

  let preferredName = current.preferredName;
  if (req.body.preferredName !== undefined) {
    if (req.body.preferredName === null || req.body.preferredName === '') {
      preferredName = null;
    } else {
      const filtered = filterPreferredName(req.body.preferredName);
      if (!filtered) {
        return res.status(400).json({
          error: 'Invalid preferred name. Must be 1-20 letters only.',
        });
      }
      preferredName = filtered;
    }
  }

  let facts = current.facts;
  if (req.body.facts !== undefined) {
    if (Array.isArray(req.body.facts)) {
      const validList: string[] = [];
      for (const raw of req.body.facts) {
        const cleaned = filterFact(raw);
        if (cleaned && !validList.includes(cleaned)) {
          validList.push(cleaned);
        }
      }
      facts = validList.slice(0, 12);
    } else {
      facts = [];
    }
  }

  const { error: upsertErr } = await req.supabase!
    .from('student_memory')
    .upsert({
      student_id: id,
      preferred_name: preferredName,
      facts,
      enabled,
      updated_at: new Date().toISOString(),
    });

  if (upsertErr) {
    console.error('[PUT /students/:id/memory Error]:', upsertErr.message);
    return res.status(500).json({ error: 'Failed to update student memory' });
  }

  return res.status(200).json({
    studentId: id,
    preferredName,
    facts,
    enabled,
  });
});

// DELETE /api/students/:id/memory (Step 9.5 / 4.5)
router.delete('/:id/memory', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data: student, error: studentError } = await req.supabase!
    .from('students')
    .select('id')
    .eq('id', id)
    .eq('parent_id', req.user!.id)
    .maybeSingle();

  if (studentError || !student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const { error: deleteErr } = await req.supabase!
    .from('student_memory')
    .delete()
    .eq('student_id', id);

  if (deleteErr) {
    console.error('[DELETE /students/:id/memory Error]:', deleteErr.message);
    return res.status(500).json({ error: 'Failed to clear student memory' });
  }

  return res.status(200).json({
    success: true,
    studentId: id,
  });
});

// DELETE /api/students/:id (Category 2 Phase 1: Child Profile Deletion with Cascade Cleanup)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = supabaseAdmin || req.supabase!;

  try {
    // 1. Ownership verification (must belong to authenticated parent)
    const { data: student, error: studentError } = await db
      .from('students')
      .select('id, student_name')
      .eq('id', id)
      .eq('parent_id', req.user!.id)
      .maybeSingle();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // 2. Cascade cleanup of student_memory (if table exists)
    const { error: memErr } = await db
      .from('student_memory')
      .delete()
      .eq('student_id', id);
    if (memErr && !isTableMissingError(memErr)) {
      console.error('[DELETE /students/:id Memory Error]:', memErr.message);
      return res.status(500).json({ error: `Failed to remove student memory: ${memErr.message}` });
    }

    // 3. Cascade cleanup of usage_events associated with student (if table exists)
    const { error: evErr } = await db
      .from('usage_events')
      .delete()
      .eq('student_id', id);
    if (evErr && !isTableMissingError(evErr)) {
      console.error('[DELETE /students/:id Events Error]:', evErr.message);
      return res.status(500).json({ error: `Failed to clear usage events: ${evErr.message}` });
    }

    // 4. Cascade cleanup of chat threads, messages & thread images (DB + Storage)
    const { data: threads, error: threadsErr } = await db
      .from('chat_threads')
      .select('id')
      .eq('student_id', id);

    if (threadsErr && !isTableMissingError(threadsErr)) {
      console.error('[DELETE /students/:id Threads Fetch Error]:', threadsErr.message);
      return res.status(500).json({ error: `Failed to query child conversations: ${threadsErr.message}` });
    }

    if (threads && threads.length > 0) {
      const threadIds = threads.map((t: any) => t.id);

      // Purge photos from Supabase Storage bucket for each thread
      for (const t of threads) {
        try {
          await deleteThreadImagesFromStorage(db, t.id);
        } catch (storageErr: any) {
          console.warn(`[DELETE /students/:id Storage Warning for thread ${t.id}]:`, storageErr?.message);
        }
      }

      const { error: imgErr } = await db
        .from('thread_images')
        .delete()
        .in('thread_id', threadIds);
      if (imgErr && !isTableMissingError(imgErr)) {
        console.error('[DELETE /students/:id Thread Images Error]:', imgErr.message);
        return res.status(500).json({ error: `Failed to delete child thread photos: ${imgErr.message}` });
      }

      const { error: msgErr } = await db
        .from('messages')
        .delete()
        .in('thread_id', threadIds);
      if (msgErr) {
        console.error('[DELETE /students/:id Messages Error]:', msgErr.message);
        return res.status(500).json({ error: `Failed to delete child messages: ${msgErr.message}` });
      }

      const { error: thDelErr } = await db
        .from('chat_threads')
        .delete()
        .eq('student_id', id);
      if (thDelErr) {
        console.error('[DELETE /students/:id Threads Delete Error]:', thDelErr.message);
        return res.status(500).json({ error: `Failed to delete child chat threads: ${thDelErr.message}` });
      }
    }

    // 5. Delete student record with select('id') to guarantee permanent removal
    const { data: deletedRows, error: deleteErr } = await db
      .from('students')
      .delete()
      .eq('id', id)
      .eq('parent_id', req.user!.id)
      .select('id');

    if (deleteErr) {
      console.error('[DELETE /students/:id Error]:', deleteErr.message);
      return res.status(500).json({ error: 'Failed to delete child profile: ' + deleteErr.message });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return res.status(404).json({ error: 'Child profile could not be removed or was already deleted' });
    }

    console.log(`[Child Profile Deleted]: StudentId=${id}, Name=${student.student_name}, DeletedRows=${deletedRows?.length || 0}`);
    return res.status(200).json({
      success: true,
      deletedStudentId: id,
      studentName: student.student_name,
    });
  } catch (err: any) {
    console.error('[DELETE /students/:id Fatal Error]:', err);
    return res.status(500).json({ error: err?.message || 'Server error deleting child profile' });
  }
});

// PATCH /api/students/:id - Update child profile name
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { student_name } = req.body;
  if (!student_name || !student_name.trim()) {
    return res.status(400).json({ error: 'student_name is required' });
  }

  const { data, error } = await req.supabase!
    .from('students')
    .update({ student_name: student_name.trim() })
    .eq('id', id)
    .eq('parent_id', req.user!.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ student: data });
});

export default router;
