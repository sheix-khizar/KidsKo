import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { generateChatReply, sanitizeChatResponse, ChatMessage } from '../lib/gemini';
import { checkAndIncrementUsage } from '../lib/usageLimits';
import { getCachedAnswer, setCachedAnswer } from '../lib/cache';
import { logUsageEvent } from '../lib/usageEvents';
import { getThreadImage, setThreadImage, getThreadStoragePath, awaitPendingUpload } from '../lib/threadImageStore';
import { downloadHomeworkImageFromStorage, deleteThreadImagesFromStorage } from '../lib/homeworkStorage';
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
      return res.status(429).json({ error: usage.reason, remaining: 0, isPremium: false });
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
      .select('grade_band')
      .eq('id', studentId)
      .maybeSingle();
    const gradeBand = student?.grade_band || 'Grade 3';

    if (isFreshThread) {
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
      if (isFreshThread) await setCachedAnswer(message, aiReply, gradeBand);
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
