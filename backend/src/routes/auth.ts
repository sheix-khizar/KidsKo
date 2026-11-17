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

// GET /api/auth/me (Get current authenticated parent details)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  return res.status(200).json({
    userId: req.user!.id,
    email: req.user!.email,
  });
});

// DELETE /api/auth/account (Category 2: Password-verified Complete Account Deletion - App Store 5.1.1 compliant)
router.delete('/account', requireAuth, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const parentEmail = req.user!.email;
  const { password } = req.body || {};

  // 1. Mandatory server-side password check
  if (!password) {
    return res.status(400).json({ error: 'Account password is required to permanently delete account.' });
  }

  const { error: pwdErr } = await supabase.auth.signInWithPassword({
    email: parentEmail,
    password,
  });

  if (pwdErr) {
    return res.status(401).json({ error: 'Incorrect password. Account deletion unauthorized.' });
  }

  const dbClient = supabaseAdmin || supabase;

  try {
    // 2. Find all student IDs for this parent
    const { data: students, error: studentsErr } = await dbClient
      .from('students')
      .select('id')
      .eq('parent_id', parentId);

    if (studentsErr) {
      console.error('[DELETE /auth/account Students Fetch Error]:', studentsErr.message);
      return res.status(500).json({ error: 'Failed to verify child accounts before deletion' });
    }

    const studentIds = (students || []).map((s: any) => s.id);

    // 3. Cascade cleanup of student memories, chat threads, messages & images
    if (studentIds.length > 0) {
      const { error: memErr } = await dbClient
        .from('student_memory')
        .delete()
        .in('student_id', studentIds);
      if (memErr) console.warn('[DELETE /auth/account Memory Cleanup Warning]:', memErr.message);

      const { data: threads } = await dbClient
        .from('chat_threads')
        .select('id')
        .in('student_id', studentIds);

      if (threads && threads.length > 0) {
        const threadIds = threads.map((t: any) => t.id);
        const { error: imgErr } = await dbClient.from('thread_images').delete().in('thread_id', threadIds);
        if (imgErr) console.warn('[DELETE /auth/account Images Cleanup Warning]:', imgErr.message);
        
        const { error: msgErr } = await dbClient.from('messages').delete().in('thread_id', threadIds);
        if (msgErr) console.warn('[DELETE /auth/account Messages Cleanup Warning]:', msgErr.message);
        
        const { error: thErr } = await dbClient.from('chat_threads').delete().in('student_id', studentIds);
        if (thErr) console.warn('[DELETE /auth/account Threads Cleanup Warning]:', thErr.message);
      }

      const { error: stErr } = await dbClient.from('students').delete().eq('parent_id', parentId);
      if (stErr) {
        console.error('[DELETE /auth/account Student Delete Error]:', stErr.message);
        return res.status(500).json({ error: 'Failed to purge child records' });
      }
    }

    // 4. Delete usage events, family usage, and profiles records
    await dbClient.from('usage_events').delete().eq('parent_id', parentId);
    await dbClient.from('family_usage').delete().eq('parent_id', parentId);
    await dbClient.from('profiles').delete().eq('id', parentId);

    // 5. Permanently delete user from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(parentId);
    if (authDeleteError) {
      console.error('[DELETE /auth/account Auth Error]:', authDeleteError.message);
      return res.status(500).json({ error: 'Failed to purge account from auth system' });
    }

    console.log(`[Account Permanently Deleted]: ParentId=${parentId}, Email=${parentEmail}`);
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
