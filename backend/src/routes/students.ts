import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

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

export default router;
