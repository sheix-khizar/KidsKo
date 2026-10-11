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
      preferredName = filterPreferredName(req.body.preferredName);
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

export default router;
