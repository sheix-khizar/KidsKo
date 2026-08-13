import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { generateChatReply, sanitizeChatResponse, ChatMessage } from '../lib/gemini';
import { checkAndIncrementUsage } from '../lib/usageLimits';
import { getCachedAnswer, setCachedAnswer } from '../lib/cache';
import { logUsageEvent } from '../lib/usageEvents';

const router = Router();

const MAX_HISTORY_MESSAGES = 10; // Ticket 2.9: bound the payload sent to Gemini

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

      const history: ChatMessage[] = (recentMessages || []).reverse().map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      aiReply = await generateChatReply(history);
      aiReply = sanitizeChatResponse(aiReply);
      if (isFreshThread) await setCachedAnswer(message, aiReply);
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
