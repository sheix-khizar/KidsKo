import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { generateChatReply, sanitizeChatResponse, ChatMessage } from '../lib/gemini';
import { checkAndIncrementUsage } from '../lib/usageLimits';
import { getCachedAnswer, setCachedAnswer, isPersonalMessage } from '../lib/cache';
import { logUsageEvent } from '../lib/usageEvents';
import { getThreadImage, setThreadImage, getThreadStoragePath, awaitPendingUpload } from '../lib/threadImageStore';
import { downloadHomeworkImageFromStorage, deleteThreadImagesFromStorage } from '../lib/homeworkStorage';
import { cleanMessageForClient } from '../lib/chatHistory';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

export const MAX_HISTORY_MESSAGES = 10; // Ticket 2.9: bound the payload sent to Gemini for cost control

// Core chat processing pipeline — exported so production routes and integration tests use the exact same single source of truth
export async function processChatTurnCore(
  supabase: SupabaseClient,
  activeThreadId: string,
  studentId: string,
  message: string
): Promise<string> {
  // 1. Save user message
  const { error: userMsgError } = await supabase.from('messages').insert({
    thread_id: activeThreadId,
    student_id: studentId,
    role: 'user',
    content: message,
  });
  if (userMsgError) throw userMsgError;

  // 2. Fetch conversational history (trimmed to MAX_HISTORY_MESSAGES)
  const { data: recentMessages, error: historyError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('thread_id', activeThreadId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);
  if (historyError) throw historyError;

  // 3. Decoupled active image lookup from thread_images table
  let activeStoragePath: string | undefined = undefined;

  try {
    const { data: latestImageRow } = await supabase
      .from('thread_images')
      .select('storage_path')
      .eq('thread_id', activeThreadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    activeStoragePath = latestImageRow?.storage_path;
  } catch (err: any) {
    // Ignore error if table not yet created in local schema
  }

  // Fallback to threadStoragePathMap if DB table not yet migrated or row missing
  if (!activeStoragePath) {
    activeStoragePath = getThreadStoragePath(activeThreadId);
  }

  let legacyBase64: string | undefined = undefined;

  // Legacy fallback: scan history if thread_images record is not present
  if (!activeStoragePath && recentMessages) {
    for (const m of recentMessages) {
      if (m.content) {
        if (m.content.includes('[STORAGE:')) {
          const match = m.content.match(/\[STORAGE:(.*?)\]/);
          if (match && match[1]) {
            activeStoragePath = match[1];
            break;
          }
        } else if (m.content.includes('[IMAGE:')) {
          const match = m.content.match(/\[IMAGE:(.*?)\]/);
          if (match && match[1]) {
            legacyBase64 = match[1];
            break;
          }
        }
      }
    }
  }

  let threadImage: { base64: string; mimeType: string } | undefined = undefined;
  let storageDownloadAttempted = false;
  let storageDownloadFailed = false;

  // 4. Resolve threadImage payload (RAM cache first, Storage download second)
  if (activeStoragePath) {
    const cached = getThreadImage(activeStoragePath) || getThreadImage(activeThreadId);
    if (cached) {
      threadImage = cached;
    } else {
      storageDownloadAttempted = true;
      try {
        const downloadedBase64 = await downloadHomeworkImageFromStorage(supabaseAdmin, activeStoragePath);
        if (downloadedBase64) {
          setThreadImage(activeStoragePath, downloadedBase64, 'image/jpeg');
          setThreadImage(activeThreadId, downloadedBase64, 'image/jpeg');
          threadImage = { base64: downloadedBase64, mimeType: 'image/jpeg' };
          console.log(`[Visual Memory Restored via thread_images]: Downloaded photo '${activeStoragePath}' for thread ${activeThreadId}`);
        } else {
          storageDownloadFailed = true;
        }
      } catch (downloadErr: any) {
        storageDownloadFailed = true;
        console.error(`[Storage Download Exception]: Thread ${activeThreadId} path ${activeStoragePath} failed:`, downloadErr.message);
      }
    }
  } else if (legacyBase64) {
    threadImage = { base64: legacyBase64, mimeType: 'image/jpeg' };
  }

  let aiReply = '';
  // 5. Handle Storage Download Failures gracefully
  if (activeStoragePath && storageDownloadAttempted && storageDownloadFailed && !threadImage) {
    console.error(`[Storage Failure Guard]: Storage download failed for thread ${activeThreadId}. Prompting student for fresh photo.`);
    aiReply = "Hmm, I lost track of your picture! Can you snap it again for me?";
  } else {
    // Format history for Gemini: strip raw [STORAGE:...] & [IMAGE:...] payload from message content text
    const history: ChatMessage[] = (recentMessages || []).reverse().map((m) => {
      let cleanContent = m.content;
      if (cleanContent.includes('[STORAGE:') || cleanContent.includes('[IMAGE:')) {
        cleanContent = cleanContent
          .replace(/📸\s*\[STORAGE:.*?\]\s*/g, '📸 ')
          .replace(/📸\s*\[IMAGE:.*?\]\s*/g, '📸 ')
          .trim();
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: cleanContent,
      };
    });

    aiReply = await generateChatReply(history, threadImage);
    aiReply = sanitizeChatResponse(aiReply);
  }

  // Save the AI's reply
  const { error: aiMsgError } = await supabase.from('messages').insert({
    thread_id: activeThreadId,
    student_id: studentId,
    role: 'assistant',
    content: aiReply,
  });
  if (aiMsgError) throw aiMsgError;

  return aiReply;
}

// POST /api/chat/cleanup { threadId } (Ticket 2.7 & COPPA NFR-4: New Chat / Thread Reset cleanup)
router.post('/cleanup', requireAuth, async (req: Request, res: Response) => {
  const { threadId } = req.body;
  if (!threadId) {
    return res.status(400).json({ error: 'threadId is required' });
  }

  try {
    const deletedCount = await deleteThreadImagesFromStorage(supabaseAdmin, threadId);
    return res.status(200).json({ success: true, threadId, deletedImagesCount: deletedCount });
  } catch (err: any) {
    console.error(`[Chat Cleanup Error]: ${err.message}`);
    return res.status(500).json({ error: 'Could not cleanup thread images' });
  }
});

// GET /api/chat/threads?studentId=&limit=30&before=<ISO> (Step 6.2 / 2.2)
router.get('/threads', requireAuth, async (req: Request, res: Response) => {
  const studentId = req.query.studentId as string;
  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }

  try {
    // 1. Verify student belongs to caller (same check as transcript.ts)
    const { data: student, error: studentError } = await req.supabase!
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('parent_id', req.user!.id)
      .maybeSingle();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // 2. Pagination & limit setup (default 30, bounded 1-100)
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 30, 1), 100);
    const before = req.query.before as string | undefined;

    let rawThreads: any[] | null = null;
    let query = req.supabase!
      .from('chat_threads')
      .select('id, title, updated_at, created_at')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false })
      .limit(limit + 1);

    if (before) {
      query = query.lt('updated_at', before);
    }

    const { data, error } = await query;
    if (error && error.message?.includes('updated_at')) {
      // Defensive fallback if migration 20261011_chat_history.sql has not yet been executed in Supabase
      let fallbackQuery = req.supabase!
        .from('chat_threads')
        .select('id, title, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (before) {
        fallbackQuery = fallbackQuery.lt('created_at', before);
      }
      const fallbackRes = await fallbackQuery;
      if (fallbackRes.error) {
        console.error('[Get Threads Fallback Error]:', fallbackRes.error.message);
        return res.status(500).json({ error: 'Failed to fetch threads' });
      }
      rawThreads = fallbackRes.data;
    } else if (error) {
      console.error('[Get Threads Error]:', error.message);
      return res.status(500).json({ error: 'Failed to fetch threads' });
    } else {
      rawThreads = data;
    }

    const hasMore = (rawThreads?.length || 0) > limit;
    const sliced = hasMore ? (rawThreads || []).slice(0, limit) : (rawThreads || []);
    const nextBefore = hasMore && sliced.length > 0
      ? (sliced[sliced.length - 1].updated_at || sliced[sliced.length - 1].created_at)
      : null;

    const threads = sliced.map((t: any) => ({
      id: t.id,
      title: t.title && t.title.trim() ? t.title.trim() : 'New chat',
      updatedAt: t.updated_at || t.created_at,
    }));

    return res.status(200).json({
      threads,
      nextBefore,
    });
  } catch (err: any) {
    console.error('[Get Threads Exception]:', err.message);
    return res.status(500).json({ error: 'Could not fetch threads' });
  }
});

// GET /api/chat/threads/:threadId/messages?limit=200 (Step 6.3 / 2.3)
router.get('/threads/:threadId/messages', requireAuth, async (req: Request, res: Response) => {
  const { threadId } = req.params;
  if (!threadId) {
    return res.status(400).json({ error: 'threadId is required' });
  }

  try {
    // 1. Verify thread belongs to one of caller's students
    const { data: thread, error: threadErr } = await req.supabase!
      .from('chat_threads')
      .select('id, student_id')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const { data: student, error: studentErr } = await req.supabase!
      .from('students')
      .select('id')
      .eq('id', thread.student_id)
      .eq('parent_id', req.user!.id)
      .maybeSingle();

    if (studentErr || !student) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // 2. Fetch messages in ascending order (default 200, max 200)
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 200, 1), 200);

    const { data: rawMessages, error: msgsErr } = await req.supabase!
      .from('messages')
      .select('role, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (msgsErr) {
      console.error('[Get Messages Error]:', msgsErr.message);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    const messages = (rawMessages || []).map((m: any) =>
      cleanMessageForClient(m.role, m.content || '', m.created_at)
    );

    return res.status(200).json({
      messages,
    });
  } catch (err: any) {
    console.error('[Get Messages Exception]:', err.message);
    return res.status(500).json({ error: 'Could not fetch messages' });
  }
});

// DELETE /api/chat/threads/:threadId (Explicit thread deletion)
router.delete('/threads/:threadId', requireAuth, async (req: Request, res: Response) => {
  const { threadId } = req.params;
  if (!threadId) {
    return res.status(400).json({ error: 'threadId is required' });
  }

  try {
    const deletedCount = await deleteThreadImagesFromStorage(supabaseAdmin, threadId);
    await req.supabase!.from('messages').delete().eq('thread_id', threadId);
    await req.supabase!.from('chat_threads').delete().eq('id', threadId);
    return res.status(200).json({ success: true, threadId, deletedImagesCount: deletedCount });
  } catch (err: any) {
    console.error(`[Thread Delete Error]: ${err.message}`);
    return res.status(500).json({ error: 'Could not delete thread' });
  }
});

// POST /api/chat  { studentId, threadId?, message }
router.post('/', requireAuth, userRateLimit, async (req: Request, res: Response) => {
  const { studentId, threadId, message } = req.body;

  if (!studentId || !message) {
    return res.status(400).json({ error: 'studentId and message are required' });
  }

  try {
    const usage = await checkAndIncrementUsage(req.supabase!, req.user!.id, 'message');
    if (!usage.allowed) {
      return res.status(429).json({ error: usage.reason, remaining: 0, isPremium: usage.isPremium });
    }

    let activeThreadId = threadId;
    const isFreshThread = !threadId;

    // Create a new thread if none was passed
    if (!activeThreadId) {
      const { data: thread, error: threadError } = await req.supabase!
        .from('chat_threads')
        .insert({ student_id: studentId, title: message.slice(0, 40) })
        .select()
        .single();

      if (threadError) throw threadError;
      activeThreadId = thread.id;
    }

    // Await any in-flight image compression/upload for this thread to prevent race conditions
    await awaitPendingUpload(activeThreadId);

    let aiReply = '';
    let servedFromCache = false;

    const { data: student } = await req.supabase!
      .from('students')
      .select('grade_band, student_name')
      .eq('id', studentId)
      .maybeSingle();
    const gradeBand = student?.grade_band || 'Grade 3';
    const studentName = student?.student_name;

    if (isFreshThread && !isPersonalMessage(message)) {
      const cached = await getCachedAnswer(message, gradeBand);
      if (cached) {
        aiReply = sanitizeChatResponse(cached);
        servedFromCache = true;
        await logUsageEvent(req.supabase!, req.user!.id, studentId, 'cache_hit');
        // Persist user & cached assistant messages to thread history for transcript view
        await req.supabase!.from('messages').insert([
          { thread_id: activeThreadId, student_id: studentId, role: 'user', content: message },
          { thread_id: activeThreadId, student_id: studentId, role: 'assistant', content: aiReply },
        ]);
      }
    }

    if (!servedFromCache) {
      aiReply = await processChatTurnCore(req.supabase!, activeThreadId, studentId, message);
      const containsStudentName = !!(studentName && new RegExp(`\\b${studentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(aiReply));
      if (isFreshThread && !isPersonalMessage(message) && !containsStudentName) {
        await setCachedAnswer(message, aiReply, gradeBand);
      }
    }

    await logUsageEvent(req.supabase!, req.user!.id, studentId, 'message');

    return res.status(200).json({
      threadId: activeThreadId,
      reply: aiReply,
      remaining: usage.remaining,
      isPremium: usage.isPremium,
    });
  } catch (error: any) {
    console.error('Chat error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
