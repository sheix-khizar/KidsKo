import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { deleteThreadImagesFromStorage } from '../lib/homeworkStorage';

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

// PUT /api/auth/password (Update parent account password)
router.put('/password', requireAuth, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const parentEmail = req.user!.email;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  // 1. Verify current password
  const { error: pwdErr } = await supabase.auth.signInWithPassword({
    email: parentEmail,
    password: currentPassword,
  });

  if (pwdErr) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // 2. Update to new password via admin client
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(parentId, {
    password: newPassword,
  });

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to update password: ' + updateErr.message });
  }

  return res.status(200).json({ success: true, message: 'Password updated successfully' });
});

// PUT /api/auth/email (Update parent account email / Gmail)
router.put('/email', requireAuth, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const parentEmail = req.user!.email;
  const { password, newEmail } = req.body || {};

  if (!password || !newEmail) {
    return res.status(400).json({ error: 'Password and new email are required' });
  }

  const trimmedEmail = newEmail.trim().toLowerCase();
  if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  // 1. Verify password
  const { error: pwdErr } = await supabase.auth.signInWithPassword({
    email: parentEmail,
    password,
  });

  if (pwdErr) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // 2. Update email in Supabase Auth
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(parentId, {
    email: trimmedEmail,
    email_confirm: true,
  });

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to update email: ' + updateErr.message });
  }

  // 3. Update profiles table
  const dbClient = supabaseAdmin || supabase;
  await dbClient.from('profiles').update({ email: trimmedEmail }).eq('id', parentId);

  return res.status(200).json({ success: true, email: trimmedEmail, message: 'Email updated successfully' });
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
      if (memErr && !memErr.message?.includes('relation "student_memory" does not exist')) {
        console.error('[DELETE /auth/account Memory Cleanup Error]:', memErr.message);
        return res.status(500).json({ error: 'Failed to purge child memory records' });
      }

      const { data: threads, error: threadsErr } = await dbClient
        .from('chat_threads')
        .select('id')
        .in('student_id', studentIds);

      if (threadsErr) {
        console.error('[DELETE /auth/account Threads Fetch Error]:', threadsErr.message);
        return res.status(500).json({ error: 'Failed to query child conversations before deletion' });
      }

      if (threads && threads.length > 0) {
        const threadIds = threads.map((t: any) => t.id);

        // Purge photos from Supabase Storage for each thread
        for (const t of threads) {
          try {
            await deleteThreadImagesFromStorage(dbClient, t.id);
          } catch (storageErr: any) {
            console.warn(`[DELETE /auth/account Storage Warning for thread ${t.id}]:`, storageErr?.message);
          }
        }

        const { error: imgErr } = await dbClient.from('thread_images').delete().in('thread_id', threadIds);
        if (imgErr && !imgErr.message?.includes('relation "thread_images" does not exist')) {
          console.error('[DELETE /auth/account Images Cleanup Error]:', imgErr.message);
          return res.status(500).json({ error: 'Failed to purge child photos' });
        }
        
        const { error: msgErr } = await dbClient.from('messages').delete().in('thread_id', threadIds);
        if (msgErr) {
          console.error('[DELETE /auth/account Messages Cleanup Error]:', msgErr.message);
          return res.status(500).json({ error: 'Failed to purge child messages' });
        }
        
        const { error: thErr } = await dbClient.from('chat_threads').delete().in('student_id', studentIds);
        if (thErr) {
          console.error('[DELETE /auth/account Threads Cleanup Error]:', thErr.message);
          return res.status(500).json({ error: 'Failed to purge child chat threads' });
        }
      }

      const { error: stErr } = await dbClient.from('students').delete().eq('parent_id', parentId);
      if (stErr) {
        console.error('[DELETE /auth/account Student Delete Error]:', stErr.message);
        return res.status(500).json({ error: 'Failed to purge child records' });
      }
    }

    // 4. Delete usage events, family usage, and profiles records
    const { error: evErr } = await dbClient.from('usage_events').delete().eq('parent_id', parentId);
    if (evErr && !evErr.message?.includes('relation "usage_events" does not exist')) {
      console.error('[DELETE /auth/account Usage Events Error]:', evErr.message);
      return res.status(500).json({ error: 'Failed to purge usage events' });
    }

    const { error: fuErr } = await dbClient.from('family_usage').delete().eq('parent_id', parentId);
    if (fuErr && !fuErr.message?.includes('relation "family_usage" does not exist')) {
      console.error('[DELETE /auth/account Family Usage Error]:', fuErr.message);
      return res.status(500).json({ error: 'Failed to purge family usage' });
    }

    const { error: profErr } = await dbClient.from('profiles').delete().eq('id', parentId);
    if (profErr) {
      console.error('[DELETE /auth/account Profile Delete Error]:', profErr.message);
      return res.status(500).json({ error: 'Failed to purge parent profile' });
    }

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
