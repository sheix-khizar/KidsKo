import { Router, Request, Response } from 'express';
import sharp from 'sharp';
import { requireAuth } from '../middleware/auth';
import { imageRateLimit } from '../middleware/userRateLimit';
import { generateHomeworkExplanation } from '../lib/gemini';
import { checkAndIncrementUsage } from '../lib/usageLimits';
import { logUsageEvent } from '../lib/usageEvents';
import { setThreadImage, registerPendingUpload } from '../lib/threadImageStore';
import { uploadHomeworkImageToStorage } from '../lib/homeworkStorage';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// POST /api/homework/analyze  { studentId, threadId?, imageBase64, prompt? }
router.post('/analyze', requireAuth, imageRateLimit, async (req: Request, res: Response) => {
  const { studentId, threadId, imageBase64, prompt } = req.body;

  if (!studentId || !imageBase64) {
    return res.status(400).json({ error: 'studentId and imageBase64 are required' });
  }

  try {
    const usage = await checkAndIncrementUsage(req.supabase!, req.user!.id, 'scan');
    if (!usage.allowed) {
      return res.status(429).json({ error: usage.reason, remaining: 0, isPremium: false });
    }

    let activeThreadId = threadId;
    if (!activeThreadId) {
      const { data: thread, error: threadError } = await req.supabase!
        .from('chat_threads')
        .insert({ student_id: studentId, title: prompt?.slice(0, 40) || 'Homework scan' })
        .select()
        .single();
      if (threadError) throw threadError;
      activeThreadId = thread.id;
    }

    // Process image compression, memory caching, and versioned storage upload as an awaited task
    const processImageTask = (async () => {
      const rawBuffer = Buffer.from(imageBase64, 'base64');
      const compressedBuffer = await sharp(rawBuffer)
        .resize({ width: 1024, height: 1024, fit: 'inside' })
        .jpeg({ quality: 75 })
        .toBuffer();
      const compressedBase64 = compressedBuffer.toString('base64');

      const imageId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Store in memory under latest threadId
      setThreadImage(activeThreadId, compressedBase64, 'image/jpeg');

      // Use service-role client for guaranteed storage operations using versioned path
      const storageResult = await uploadHomeworkImageToStorage(supabaseAdmin, activeThreadId, compressedBuffer, imageId);

      if (storageResult) {
        // Also store in memory under specific storagePath
        setThreadImage(storageResult.storagePath, compressedBase64, 'image/jpeg');

        // STEP 2: Decoupled thread_images table insert
        try {
          await req.supabase!.from('thread_images').insert({
            thread_id: activeThreadId,
            storage_path: storageResult.storagePath,
          });
        } catch (dbErr: any) {
          console.warn(`[thread_images Insert Notice]: ${dbErr.message}`);
        }
      }

      return { compressedBase64, storageResult };
    })();

    // Register pending task so parallel follow-up requests in POST /api/chat will await it
    registerPendingUpload(activeThreadId, processImageTask);

    const { compressedBase64, storageResult } = await processImageTask;

    // Format DB message content: use lightweight versioned Storage Path reference if uploaded, else fallback
    const userPromptText = prompt?.trim() || '';
    const userMessageContent = storageResult
      ? `📸 [STORAGE:${storageResult.storagePath}] ${userPromptText || '[Homework photo submitted]'}`.trim()
      : `📸 [IMAGE:${compressedBase64}] ${userPromptText || '[Homework photo submitted]'}`.trim();

    // Log the scan as a message (image type)
    await req.supabase!.from('messages').insert({
      thread_id: activeThreadId,
      student_id: studentId,
      role: 'user',
      content: userMessageContent,
      message_type: 'image',
    });

    const explanation = await generateHomeworkExplanation(compressedBase64, 'image/jpeg', prompt);

    await req.supabase!.from('messages').insert({
      thread_id: activeThreadId,
      student_id: studentId,
      role: 'assistant',
      content: explanation,
    });

    await logUsageEvent(req.supabase!, req.user!.id, studentId, 'scan');

    return res.status(200).json({
      threadId: activeThreadId,
      explanation,
      remaining: usage.remaining,
      isPremium: usage.isPremium,
    });
  } catch (error: any) {
    console.error('Homework analysis error:', error.message);
    return res.status(500).json({
      error: "I couldn't quite read that photo. Can you try again with better lighting?",
    });
  }
});

export default router;
