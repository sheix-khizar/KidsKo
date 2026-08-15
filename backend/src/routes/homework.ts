import { Router, Request, Response } from 'express';
import sharp from 'sharp';
import { requireAuth } from '../middleware/auth';
import { generateHomeworkExplanation, sanitizeChatResponse } from '../lib/gemini';
import { uploadHomeworkImageToStorage } from '../lib/homeworkStorage';
import { setThreadImage, setThreadStoragePath, registerPendingUpload } from '../lib/threadImageStore';
import { checkAndIncrementUsage } from '../lib/usageLimits';
import { logUsageEvent } from '../lib/usageEvents';
import { supabaseAdmin } from '../lib/supabase';

let uploadMiddleware: any = (_req: any, _res: any, next: any) => next();
try {
  const multer = require('multer');
  uploadMiddleware = multer({ limits: { fileSize: 10 * 1024 * 1024 } }).single('image');
} catch (e) {
  // Ignore if multer package is not present
}

const router = Router();

// POST /api/homework/analyze — Uploads and analyzes a homework image snapshot (supports multipart file & JSON imageBase64)
router.post('/analyze', requireAuth, uploadMiddleware, async (req: Request, res: Response) => {
  const { studentId, imageBase64, threadId, prompt } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }

  const file = (req as any).file;
  let imageBuffer: Buffer | undefined = undefined;

  if (file && file.buffer) {
    imageBuffer = file.buffer;
  } else if (imageBase64) {
    // Strip data URI scheme prefix if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    imageBuffer = Buffer.from(cleanBase64, 'base64');
  }

  if (!imageBuffer) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  try {
    const usage = await checkAndIncrementUsage(req.supabase!, req.user!.id, 'scan');
    if (!usage.allowed) {
      return res.status(429).json({ error: usage.reason, remaining: 0, isPremium: false });
    }

    let activeThreadId = threadId;

    // Create a thread if none was passed
    if (!activeThreadId) {
      const { data: thread, error: threadError } = await req.supabase!
        .from('chat_threads')
        .insert({ student_id: studentId, title: 'Homework Help' })
        .select()
        .single();

      if (threadError) throw threadError;
      activeThreadId = thread.id;
    }

    // Register a background task promise to compress, upload to Storage, and save in DB
    const imageId = `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const processImageTask = (async () => {
      // Compress image using Sharp
      const compressedBuffer = await sharp(imageBuffer!)
        .resize({ width: 1024, height: 1024, fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const compressedBase64 = compressedBuffer.toString('base64');

      // Store in memory under latest threadId
      setThreadImage(activeThreadId, compressedBase64, 'image/jpeg');

      // Use service-role client for guaranteed storage operations using versioned path
      const storageResult = await uploadHomeworkImageToStorage(supabaseAdmin, activeThreadId, compressedBuffer, imageId);

      if (storageResult) {
        // Also store in memory under specific storagePath and threadId
        setThreadImage(storageResult.storagePath, compressedBase64, 'image/jpeg');
        setThreadStoragePath(activeThreadId, storageResult.storagePath);

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
    const messageContentText = storageResult
      ? `📸 [STORAGE:${storageResult.storagePath}] ${userPromptText}`
      : `📸 [IMAGE:${compressedBase64}] ${userPromptText}`;

    // Save user message to database
    await req.supabase!.from('messages').insert({
      thread_id: activeThreadId,
      student_id: studentId,
      role: 'user',
      content: messageContentText,
      message_type: 'image',
    });

    // Generate AI explanation with Gemini Vision
    const rawExplanation = await generateHomeworkExplanation(compressedBase64, 'image/jpeg', prompt);
    const explanation = sanitizeChatResponse(rawExplanation);

    // Save AI response to database
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
    console.error('Homework error:', error.message);
    return res.status(500).json({ error: 'Failed to analyze homework image. Please try again.' });
  }
});

export default router;
