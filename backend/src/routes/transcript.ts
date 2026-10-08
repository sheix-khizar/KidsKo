import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/transcript/:studentId — free for everyone, gated client-side by ParentalGate only
router.get('/:studentId', requireAuth, async (req: Request, res: Response) => {
  const { studentId } = req.params;

  // Defense-in-depth ownership check even though RLS should already enforce this
  const { data: student, error: studentError } = await req.supabase!
    .from('students')
    .select('id, student_name')
    .eq('id', studentId)
    .eq('parent_id', req.user!.id)
    .maybeSingle();

  if (studentError || !student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const { data: messages, error } = await req.supabase!
    .from('messages')
    .select('role, content, message_type, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ studentName: student.student_name, messages });
});

export default router;
