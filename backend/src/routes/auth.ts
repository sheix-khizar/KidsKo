import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { deleteThreadImagesFromStorage } from '../lib/homeworkStorage';
import { checkVoiceEligibility } from '../lib/voiceLimits';

const router = Router();

// Ephemeral unpersisted Supabase client for memory-isolated auth calls per request
function createEphemeralAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Dedicated rate limiter for sensitive authentication attempts (10 attempts / min per client IP)
const authAttemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts. Please wait a minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

// POST /api/auth/register - Initiates registration with email & password (enforces 8+ chars and OTP flow)
router.post('/register', authAttemptLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  // Common email domain typos check to prevent failed OTP deliveries
  if (
    trimmedEmail.endsWith('@gmail.cm') ||
    trimmedEmail.endsWith('@gmai.com') ||
    trimmedEmail.endsWith('@gamil.com') ||
    trimmedEmail.endsWith('@gmial.com')
  ) {
    return res.status(400).json({ error: 'Did you mean @gmail.com? Please check your email spelling.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const authClient = createEphemeralAuthClient();
  const { data, error } = await authClient.auth.signUp({
    email: trimmedEmail,
    password,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already exists')) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }
    return res.status(400).json({ error: msg });
  }

  if (!data.user) {
    return res.status(500).json({ error: 'User creation failed unexpectedly' });
  }

  // Supabase security convention: if an account already exists, signUp returns an empty identities array and sends NO email
  if (data.user.identities && data.user.identities.length === 0) {
    return res.status(400).json({
      error: 'An account with this email already exists. Please sign in or reset your password.',
    });
  }

  // Ensure profiles row exists for FK relationships
  try {
    await supabaseAdmin.from('profiles').upsert({ id: data.user.id, email: trimmedEmail });
  } catch (profErr: any) {
    console.warn('[Register Profile Upsert Warning]:', profErr?.message);
  }

  const needsVerification = !data.session;

  return res.status(201).json({
    message: needsVerification
      ? 'Verification code sent to your email'
      : 'Account created successfully',
    userId: data.user.id,
    email: trimmedEmail,
    needsVerification,
    session: data.session || undefined,
  });
});

// POST /api/auth/verify-otp - Verifies 6-digit email confirmation code
router.post('/verify-otp', authAttemptLimiter, async (req: Request, res: Response) => {
  const { email, token, type } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedToken = token.trim();

  const authClient = createEphemeralAuthClient();
  const otpType = (type === 'recovery' || type === 'email_change') ? type : 'signup';

  const { data, error } = await authClient.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: otpType as any,
  });

  if (error || !data.user) {
    return res.status(400).json({
      error: error?.message || 'Invalid or expired verification code. Please request a new one.',
    });
  }

  // Ensure profile exists once verified
  try {
    await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email || trimmedEmail,
    });
  } catch {}

  return res.status(200).json({
    message: 'Email verified successfully',
    userId: data.user.id,
    session: data.session,
  });
});

// POST /api/auth/resend-otp - Resends email confirmation or recovery code
router.post('/resend-otp', authAttemptLimiter, async (req: Request, res: Response) => {
  const { email, type } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const authClient = createEphemeralAuthClient();

  if (type === 'recovery') {
    const { error } = await authClient.auth.resetPasswordForEmail(trimmedEmail);
    if (error) {
      const msg = error.message || '';
      const lower = msg.toLowerCase();
      if (error.status === 429 || lower.includes('rate limit') || lower.includes('only request this after')) {
        return res.status(429).json({ error: msg });
      }
      return res.status(400).json({ error: msg || 'Failed to resend recovery code.' });
    }
    return res.status(200).json({
      message: 'A new password reset code has been sent to your email.',
    });
  }

  const { error } = await authClient.auth.resend({
    email: trimmedEmail,
    type: 'signup',
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({
    message: 'A new verification code has been sent to your email.',
  });
});

// POST /api/auth/refresh - Automatically renews expired 1-hour session using refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  const authClient = createEphemeralAuthClient();
  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    return res.status(401).json({
      error: 'Session has expired or refresh token is invalid. Please log in again.',
    });
  }

  return res.status(200).json({
    message: 'Session refreshed successfully',
    userId: data.user?.id,
    session: data.session,
  });
});

// POST /api/auth/forgot-password - Initiates password recovery email with OTP code
router.post('/forgot-password', authAttemptLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (
    trimmedEmail.endsWith('@gmail.cm') ||
    trimmedEmail.endsWith('@gmai.com') ||
    trimmedEmail.endsWith('@gamil.com') ||
    trimmedEmail.endsWith('@gmial.com')
  ) {
    return res.status(400).json({ error: 'Did you mean @gmail.com? Please check your email spelling.' });
  }

  const authClient = createEphemeralAuthClient();
  const { error } = await authClient.auth.resetPasswordForEmail(trimmedEmail);

  if (error) {
    const msg = error.message || '';
    const lower = msg.toLowerCase();
    console.warn('[Forgot Password Error]:', error.status, msg);

    if (
      error.status === 429 ||
      lower.includes('rate limit') ||
      lower.includes('too many') ||
      lower.includes('only request this after')
    ) {
      return res.status(429).json({
        error: msg || 'Too many reset requests. Please wait a minute and try again.',
      });
    }

    if ((error.status && error.status >= 500) || lower.includes('smtp') || lower.includes('sending')) {
      return res.status(502).json({
        error: 'Email service could not send the reset code right now. Please try again shortly.',
      });
    }
  }

  return res.status(200).json({
    message: 'If an account exists with this email, a password reset code has been sent.',
  });
});

// POST /api/auth/reset-password - Verifies recovery code and sets new password
router.post('/reset-password', authAttemptLimiter, async (req: Request, res: Response) => {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, reset code, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedToken = token.trim();
  const authClient = createEphemeralAuthClient();

  // 1. Verify recovery OTP
  const { data, error } = await authClient.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: 'recovery',
  });

  if (error || !data.user) {
    return res.status(400).json({ error: 'Invalid or expired password reset code. Please request a new one.' });
  }

  // 2. Set new password via admin client
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    password: newPassword,
  });

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to reset password: ' + updateErr.message });
  }

  return res.status(200).json({
    success: true,
    message: 'Password reset successfully! You can now log in with your new password.',
  });
});

// POST /api/auth/login - Parent sign-in (isolated ephemeral client per request)
router.post('/login', authAttemptLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const authClient = createEphemeralAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  // Ensure profiles row exists on login if missing
  if (data.user) {
    await supabaseAdmin.from('profiles').upsert({ id: data.user.id, email: data.user.email || trimmedEmail });
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

// GET /api/auth/voice-eligibility (Get real weekly remaining voice & video allowance)
router.get('/voice-eligibility', requireAuth, async (req: Request, res: Response) => {
  try {
    const parentId = req.user!.id;
    const dbClient = req.supabase || supabaseAdmin;
    const eligibility = await checkVoiceEligibility(dbClient, parentId);
    return res.status(200).json(eligibility);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Could not check voice eligibility' });
  }
});

// PUT /api/auth/password (Update parent account password - legacy direct update)
router.put('/password', requireAuth, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const parentEmail = req.user!.email;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
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

// POST /api/auth/password/request-otp (Step 1: Verify current password & send OTP to parent's email)
router.post('/password/request-otp', requireAuth, authAttemptLimiter, async (req: Request, res: Response) => {
  const parentEmail = req.user!.email;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  // 1. Verify current password
  const { error: pwdErr } = await supabase.auth.signInWithPassword({
    email: parentEmail,
    password: currentPassword,
  });

  if (pwdErr) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // 2. Dispatch recovery OTP to registered parent email
  const authClient = createEphemeralAuthClient();
  const { error: resetErr } = await authClient.auth.resetPasswordForEmail(parentEmail);

  if (resetErr) {
    return res.status(500).json({ error: 'Failed to send verification code: ' + resetErr.message });
  }

  return res.status(200).json({
    success: true,
    message: `Verification code sent to ${parentEmail}`,
  });
});

// POST /api/auth/password/confirm-otp (Step 2: Verify OTP & commit new password)
router.post('/password/confirm-otp', requireAuth, authAttemptLimiter, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const parentEmail = req.user!.email;
  const { token, newPassword } = req.body || {};

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Verification code and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  const authClient = createEphemeralAuthClient();

  // 1. Verify recovery OTP
  const { data, error } = await authClient.auth.verifyOtp({
    email: parentEmail,
    token: token.trim(),
    type: 'recovery',
  });

  if (error || !data.user) {
    return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new one.' });
  }

  // 2. Set new password via admin client
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(parentId, {
    password: newPassword,
  });

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to update password: ' + updateErr.message });
  }

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
});

// PUT /api/auth/email (Update parent account email / Gmail - legacy direct update)
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

// POST /api/auth/email/request-otp (Step 1: Verify current password & send OTP to new email)
router.post('/email/request-otp', requireAuth, authAttemptLimiter, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const parentEmail = req.user!.email;
  const { password, newEmail } = req.body || {};

  if (!password || !newEmail) {
    return res.status(400).json({ error: 'Password and new email are required' });
  }

  const trimmedEmail = newEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (
    trimmedEmail.endsWith('@gmail.cm') ||
    trimmedEmail.endsWith('@gmai.com') ||
    trimmedEmail.endsWith('@gamil.com') ||
    trimmedEmail.endsWith('@gmial.com')
  ) {
    return res.status(400).json({ error: 'Did you mean @gmail.com? Please check your email spelling.' });
  }

  if (trimmedEmail === parentEmail.toLowerCase()) {
    return res.status(400).json({ error: 'New email must be different from your current email' });
  }

  // 1. Verify current account password
  const { error: pwdErr } = await supabase.auth.signInWithPassword({
    email: parentEmail,
    password,
  });

  if (pwdErr) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // 2. Check if new email is already in use by another account
  const dbClient = supabaseAdmin || supabase;
  const { data: existingProfile } = await dbClient
    .from('profiles')
    .select('id')
    .eq('email', trimmedEmail)
    .maybeSingle();

  if (existingProfile && existingProfile.id !== parentId) {
    return res.status(400).json({ error: 'This email is already associated with another account.' });
  }

  // 3. Dispatch OTP to the new email address
  const authClient = createEphemeralAuthClient();
  const { error: otpErr } = await authClient.auth.signInWithOtp({
    email: trimmedEmail,
  });

  if (otpErr) {
    return res.status(500).json({ error: 'Failed to send verification code to new email: ' + otpErr.message });
  }

  return res.status(200).json({
    success: true,
    message: `Verification code sent to ${trimmedEmail}`,
  });
});

// POST /api/auth/email/confirm-otp (Step 2: Verify OTP sent to new email & commit email change)
router.post('/email/confirm-otp', requireAuth, authAttemptLimiter, async (req: Request, res: Response) => {
  const parentId = req.user!.id;
  const { newEmail, token } = req.body || {};

  if (!newEmail || !token) {
    return res.status(400).json({ error: 'New email and verification code are required' });
  }

  const trimmedEmail = newEmail.trim().toLowerCase();
  const trimmedToken = token.trim();

  const authClient = createEphemeralAuthClient();

  // 1. Verify OTP for the new email address
  const { data: verifyData, error: verifyErr } = await authClient.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: 'email',
  });

  if (verifyErr || !verifyData?.user) {
    return res.status(400).json({
      error: 'Invalid or expired verification code. Please check the code and try again.',
    });
  }

  // 2. Clean up temporary shadow user if signInWithOtp created one
  const tempUserId = verifyData.user.id;
  if (tempUserId && tempUserId !== parentId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(tempUserId);
    } catch (delErr: any) {
      console.warn('[Email Change Temp User Cleanup Warning]:', delErr?.message);
    }
  }

  // 3. Update parent email in Supabase Auth and mark confirmed
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(parentId, {
    email: trimmedEmail,
    email_confirm: true,
  });

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to update email: ' + updateErr.message });
  }

  // 4. Update profiles table
  const dbClient = supabaseAdmin || supabase;
  await dbClient.from('profiles').update({ email: trimmedEmail }).eq('id', parentId);

  return res.status(200).json({
    success: true,
    email: trimmedEmail,
    message: 'Email updated successfully',
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
      if (memErr && !isTableMissingError(memErr)) {
        console.error('[DELETE /auth/account Memory Cleanup Error]:', memErr.message);
        return res.status(500).json({ error: 'Failed to purge child memory records' });
      }

      const { data: threads, error: threadsErr } = await dbClient
        .from('chat_threads')
        .select('id')
        .in('student_id', studentIds);

      if (threadsErr && !isTableMissingError(threadsErr)) {
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
        if (imgErr && !isTableMissingError(imgErr)) {
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
    if (evErr && !isTableMissingError(evErr)) {
      console.error('[DELETE /auth/account Usage Events Error]:', evErr.message);
      return res.status(500).json({ error: 'Failed to purge usage events' });
    }

    const { error: fuErr } = await dbClient.from('family_usage').delete().eq('parent_id', parentId);
    if (fuErr && !isTableMissingError(fuErr)) {
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
