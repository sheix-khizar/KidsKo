import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!data.user) {
    return res.status(500).json({ error: 'User creation failed unexpectedly' });
  }

  // Ensure profiles row exists for FK relationships (e.g. family_usage)
  await supabase.from('profiles').upsert({ id: data.user.id, email: data.user.email });

  return res.status(201).json({
    message: 'Account created successfully',
    userId: data.user.id,
    session: data.session,
  });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  // Ensure profiles row exists on login if missing
  if (data.user) {
    await supabase.from('profiles').upsert({ id: data.user.id, email: data.user.email });
  }

  return res.status(200).json({
    message: 'Login successful',
    userId: data.user.id,
    session: data.session,
  });
});

// DELETE /api/auth/account (Category 2 Phase 1: Complete Account Deletion - App Store 5.1.1 compliant)
router.delete('/account', requireAuth, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const dbClient = supabaseAdmin || supabase;

  try {
    // 1. Find all student IDs for this parent
    const { data: students } = await dbClient
      .from('students')
      .select('id')
      .eq('parent_id', parentId);

    const studentIds = (students || []).map((s: any) => s.id);

    // 2. Cascade cleanup of student memories, chat threads, messages & images
    if (studentIds.length > 0) {
      await dbClient
        .from('student_memory')
        .delete()
        .in('student_id', studentIds);

      const { data: threads } = await dbClient
        .from('chat_threads')
        .select('id')
        .in('student_id', studentIds);

      if (threads && threads.length > 0) {
        const threadIds = threads.map((t: any) => t.id);
        await dbClient.from('thread_images').delete().in('thread_id', threadIds);
        await dbClient.from('messages').delete().in('thread_id', threadIds);
        await dbClient.from('chat_threads').delete().in('student_id', studentIds);
      }

      await dbClient.from('students').delete().eq('parent_id', parentId);
    }

    // 3. Delete usage events, family usage, and profiles records
    await dbClient.from('usage_events').delete().eq('parent_id', parentId);
    await dbClient.from('family_usage').delete().eq('parent_id', parentId);
    await dbClient.from('profiles').delete().eq('id', parentId);

    // 4. Permanently delete user from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(parentId);
    if (authDeleteError) {
      console.error('[DELETE /auth/account Auth Error]:', authDeleteError.message);
      return res.status(500).json({ error: 'Failed to purge account from auth system' });
    }

    console.log(`[Account Permanently Deleted]: ParentId=${parentId}, Email=${req.user!.email}`);
    return res.status(200).json({
      success: true,
      message: 'Parent account and all associated child data permanently deleted',
    });
  } catch (err: any) {
    console.error('[DELETE /auth/account Exception]:', err?.message || err);
    return res.status(500).json({ error: 'Account deletion failed unexpectedly' });
  }
});

export default router;
