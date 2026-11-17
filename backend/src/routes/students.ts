import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getMemory, filterFact, filterPreferredName } from '../lib/studentMemory';

const router = Router();

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
    .select('id, created_at')
    .eq('student_id', id);

  const threadIds = (threads || []).map((t: any) => t.id);

  let userMessages: { created_at: string }[] = [];
  if (threadIds.length > 0) {
    const { data: msgs } = await req.supabase!
      .from('messages')
      .select('created_at')
      .in('thread_id', threadIds)
      .eq('role', 'user');
    userMessages = msgs || [];
  }

  // 3. Calculate real metrics
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const questionsToday = userMessages.filter(
    (m) => new Date(m.created_at).getTime() >= startOfToday
  ).length;

  const questionsThisWeek = userMessages.filter(
    (m) => new Date(m.created_at).getTime() >= sevenDaysAgo
  ).length;

  const topicsExplored = threadIds.length;

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

  return res.status(200).json({
    studentId: id,
    studentName: student.student_name,
    questionsToday,
    questionsThisWeek,
    topicsExplored,
    streak,
    dailyCounts,
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

  try {
    // 1. Ownership verification
    const { data: student, error: studentError } = await req.supabase!
      .from('students')
      .select('id, student_name')
      .eq('id', id)
      .eq('parent_id', req.user!.id)
      .maybeSingle();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // 2. Cascade cleanup of student_memory (ignoring missing table warnings)
    try {
      await req.supabase!
        .from('student_memory')
        .delete()
        .eq('student_id', id);
    } catch (memErr: any) {
      console.warn('[DELETE /students/:id Memory Warning]:', memErr?.message);
    }

    // 3. Cascade cleanup of usage_events associated with student
    try {
      await req.supabase!
        .from('usage_events')
        .delete()
        .eq('student_id', id);
    } catch (evErr: any) {
      console.warn('[DELETE /students/:id Events Warning]:', evErr?.message);
    }

    // 4. Cascade cleanup of chat threads, messages & thread images
    try {
      const { data: threads } = await req.supabase!
        .from('chat_threads')
        .select('id')
        .eq('student_id', id);

      if (threads && threads.length > 0) {
        const threadIds = threads.map((t: any) => t.id);
        try {
          await req.supabase!
            .from('thread_images')
            .delete()
            .in('thread_id', threadIds);
        } catch {}
        try {
          await req.supabase!
            .from('messages')
            .delete()
            .in('thread_id', threadIds);
        } catch {}
        try {
          await req.supabase!
            .from('chat_threads')
            .delete()
            .eq('student_id', id);
        } catch {}
      }
    } catch (thErr: any) {
      console.warn('[DELETE /students/:id Threads Warning]:', thErr?.message);
    }

    // 5. Delete student record
    const { error: deleteErr } = await req.supabase!
      .from('students')
      .delete()
      .eq('id', id)
      .eq('parent_id', req.user!.id);

    if (deleteErr) {
      console.error('[DELETE /students/:id Error]:', deleteErr.message);
      return res.status(500).json({ error: 'Failed to delete child profile: ' + deleteErr.message });
    }

    console.log(`[Child Profile Deleted]: StudentId=${id}, Name=${student.student_name}, ParentId=${req.user!.id}`);
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

export default router;
