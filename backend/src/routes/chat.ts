import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { generateChatReply, sanitizeChatResponse, ChatMessage } from '../lib/gemini';
import { checkAndIncrementUsage } from '../lib/usageLimits';
import { getCachedAnswer, setCachedAnswer } from '../lib/cache';
import { logUsageEvent } from '../lib/usageEvents';
import { getThreadImage, setThreadImage, awaitPendingUpload } from '../lib/threadImageStore';
import { downloadHomeworkImageFromStorage, deleteThreadImagesFromStorage } from '../lib/homeworkStorage';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

const MAX_HISTORY_MESSAGES = 10; // Ticket 2.9: bound the payload sent to Gemini

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

    // Save the user's message
    const { error: userMsgError } = await req.supabase!.from('messages').insert({
      thread_id: activeThreadId,
      student_id: studentId,
      role: 'user',
      content: message,
    });
    if (userMsgError) throw userMsgError;

    let aiReply = '';
    let servedFromCache = false;

    if (isFreshThread) {
      const cached = await getCachedAnswer(message);
      if (cached) {
        aiReply = sanitizeChatResponse(cached);
        servedFromCache = true;
        await logUsageEvent(req.supabase!, req.user!.id, studentId, 'cache_hit');
      }
    }

    if (!servedFromCache) {
      const { data: recentMessages, error: historyError } = await req.supabase!
        .from('messages')
        .select('role, content')
        .eq('thread_id', activeThreadId)
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORY_MESSAGES);
      if (historyError) throw historyError;

      let threadImage: { base64: string; mimeType: string } | undefined = undefined;
      let hasImageMarkerInHistory = false;
      let storageDownloadAttempted = false;
      let storageDownloadFailed = false;

      // Scan history for versioned image references
      const imageMarkers: { storagePath?: string; base64?: string }[] = [];

      if (recentMessages) {
        for (const m of recentMessages) {
          if (m.content) {
            if (m.content.includes('[STORAGE:')) {
              hasImageMarkerInHistory = true;
              const match = m.content.match(/\[STORAGE:(.*?)\]/);
              if (match && match[1]) {
                imageMarkers.push({ storagePath: match[1] });
              }
            } else if (m.content.includes('[IMAGE:')) {
              hasImageMarkerInHistory = true;
              const match = m.content.match(/\[IMAGE:(.*?)\]/);
              if (match && match[1]) {
                imageMarkers.push({ base64: match[1] });
              }
            }
          }
        }
      }

      if (imageMarkers.length > 0) {
        // STEP 3: Multi-Image Context Resolution
        // Check if student's prompt specifically requests an earlier / first photo
        const requestsEarlierPicture = /first (picture|photo|image|worksheet)|earlier (picture|photo|image|worksheet)|previous (picture|photo|image|worksheet)|go back to/i.test(message);

        // imageMarkers is ordered newest to oldest. Pick earliest if requested, else most recent (index 0)
        const targetMarker = (requestsEarlierPicture && imageMarkers.length > 1)
          ? imageMarkers[imageMarkers.length - 1]
          : imageMarkers[0];

        if (targetMarker.storagePath) {
          // Check memory cache by storagePath or threadId first
          const cached = getThreadImage(targetMarker.storagePath) || getThreadImage(activeThreadId);
          if (cached) {
            threadImage = cached;
          } else {
            storageDownloadAttempted = true;
            try {
              const downloadedBase64 = await downloadHomeworkImageFromStorage(supabaseAdmin, targetMarker.storagePath);
              if (downloadedBase64) {
                setThreadImage(targetMarker.storagePath, downloadedBase64, 'image/jpeg');
                setThreadImage(activeThreadId, downloadedBase64, 'image/jpeg');
                threadImage = { base64: downloadedBase64, mimeType: 'image/jpeg' };
                console.log(`[Visual Memory Restored]: Downloaded photo '${targetMarker.storagePath}' for thread ${activeThreadId}`);
              } else {
                storageDownloadFailed = true;
              }
            } catch (downloadErr: any) {
              storageDownloadFailed = true;
              console.error(`[Storage Download Exception]: Thread ${activeThreadId} path ${targetMarker.storagePath} failed:`, downloadErr.message);
            }
          }
        } else if (targetMarker.base64) {
          threadImage = { base64: targetMarker.base64, mimeType: 'image/jpeg' };
        }
      }

      // Handle Storage Download Failures gracefully
      if (hasImageMarkerInHistory && storageDownloadAttempted && storageDownloadFailed && !threadImage) {
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
        if (isFreshThread) await setCachedAnswer(message, aiReply);
      }
    }

    await logUsageEvent(req.supabase!, req.user!.id, studentId, 'message');

    // Save the AI's reply
    const { error: aiMsgError } = await req.supabase!.from('messages').insert({
      thread_id: activeThreadId,
      student_id: studentId,
      role: 'assistant',
      content: aiReply,
    });
    if (aiMsgError) throw aiMsgError;

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
