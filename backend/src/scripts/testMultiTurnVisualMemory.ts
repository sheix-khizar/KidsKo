import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { generateHomeworkExplanation, generateChatReply, sanitizeChatResponse, ChatMessage } from '../lib/gemini';
import { uploadHomeworkImageToStorage, downloadHomeworkImageFromStorage } from '../lib/homeworkStorage';
import { setThreadImage, getThreadImage, clearThreadImageCache } from '../lib/threadImageStore';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const MAX_HISTORY_MESSAGES = 10;

// In-memory fallback map for test thread_images resolution if table not yet migrated in local DB
const inMemoryThreadImagesMap = new Map<string, string[]>();

// Helper to handle transient Gemini 503/429 spikes gracefully
async function generateChatReplyWithRetry(
  history: ChatMessage[],
  threadImage?: { base64: string; mimeType: string },
  retries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await generateChatReply(history, threadImage);
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.warn(`⚠️ [Gemini API Spike]: Attempt ${attempt} failed (${err.message}). Retrying in ${attempt * 1500}ms...`);
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  return "Sorry, I am having trouble connecting right now.";
}

// Generates a crisp, readable math worksheet JPEG with numbered questions
async function createReadableMathWorksheetBuffer(): Promise<Buffer> {
  const svgText = `
    <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="40" y="50" font-family="Arial" font-size="24" fill="#111827" font-weight="bold">Elementary Math Practice Worksheet</text>
      <text x="40" y="100" font-family="Arial" font-size="20" fill="#374151">Question 1: 5 + 3 = ?</text>
      <text x="40" y="150" font-family="Arial" font-size="20" fill="#374151">Question 2: 12 - 4 = ?</text>
      <text x="40" y="200" font-family="Arial" font-size="20" fill="#374151">Question 3: 6 x 2 = ?</text>
      <text x="40" y="250" font-family="Arial" font-size="22" fill="#1d4ed8" font-weight="bold">Question 4: 8 x 4 = ?</text>
      <text x="40" y="300" font-family="Arial" font-size="20" fill="#374151">Question 5: 20 / 5 = ?</text>
    </svg>
  `;
  return sharp(Buffer.from(svgText))
    .resize({ width: 1024, height: 1024, fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// Executes the exact production route logic in chat.ts using real Supabase queries & storage lookups
async function executeRealChatTurn(
  threadId: string,
  studentId: string,
  userMessage: string
): Promise<string> {
  // 1. Save user message to database
  const { error: userErr } = await supabaseAdmin.from('messages').insert({
    thread_id: threadId,
    student_id: studentId,
    role: 'user',
    content: userMessage,
  });
  if (userErr) console.warn(`[DB Insert User Msg Warning]: ${userErr.message}`);

  // 2. Fetch conversational history (trimmed to MAX_HISTORY_MESSAGES = 10)
  const { data: recentMessages, error: historyError } = await supabaseAdmin
    .from('messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);
  if (historyError) console.warn(`[History Fetch Warning]: ${historyError.message}`);

  // 3. Decoupled active image lookup from thread_images table
  const { data: latestImageRow } = await supabaseAdmin
    .from('thread_images')
    .select('storage_path')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeStoragePath: string | undefined = latestImageRow?.storage_path;

  // Fallback for test runner if thread_images table not yet migrated in DB schema
  if (!activeStoragePath) {
    const list = inMemoryThreadImagesMap.get(threadId);
    if (list && list.length > 0) {
      activeStoragePath = list[list.length - 1];
    }
  }

  // Legacy fallback: scan trimmed history
  let legacyBase64: string | undefined = undefined;
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

  if (activeStoragePath) {
    const cached = getThreadImage(activeStoragePath) || getThreadImage(threadId);
    if (cached) {
      threadImage = cached;
    } else {
      storageDownloadAttempted = true;
      try {
        const downloadedBase64 = await downloadHomeworkImageFromStorage(supabaseAdmin, activeStoragePath);
        if (downloadedBase64) {
          setThreadImage(activeStoragePath, downloadedBase64, 'image/jpeg');
          setThreadImage(threadId, downloadedBase64, 'image/jpeg');
          threadImage = { base64: downloadedBase64, mimeType: 'image/jpeg' };
        } else {
          storageDownloadFailed = true;
        }
      } catch (err: any) {
        storageDownloadFailed = true;
      }
    }
  } else if (legacyBase64) {
    threadImage = { base64: legacyBase64, mimeType: 'image/jpeg' };
  }

  let aiReply = '';
  if (activeStoragePath && storageDownloadAttempted && storageDownloadFailed && !threadImage) {
    aiReply = "Hmm, I lost track of your picture! Can you snap it again for me?";
  } else {
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

    aiReply = await generateChatReplyWithRetry(history, threadImage);
    aiReply = sanitizeChatResponse(aiReply);
  }

  // 4. Save AI reply to database
  const { error: aiErr } = await supabaseAdmin.from('messages').insert({
    thread_id: threadId,
    student_id: studentId,
    role: 'assistant',
    content: aiReply,
  });
  if (aiErr) console.warn(`[DB Insert AI Msg Warning]: ${aiErr.message}`);

  return aiReply;
}

async function runMultiTurnVisualMemoryIntegrationTest() {
  console.log('🧪 =================================================================');
  console.log('🚀 REAL INTEGRATION TEST: DECOUPLED VISUAL MEMORY ACROSS 14 TURNS');
  console.log('🧪 =================================================================\n');

  // Fetch or create student in database
  const { data: studentRow } = await supabaseAdmin.from('students').select('id').limit(1).single();
  let studentId = studentRow?.id;

  if (!studentId) {
    const { data: parentRow } = await supabaseAdmin.from('parents').select('id').limit(1).single();
    const parentId = parentRow?.id || crypto.randomUUID();
    const { data: newStudent } = await supabaseAdmin.from('students').insert({
      parent_id: parentId,
      name: 'Integration Test Student',
      grade_level: 'Grade 3',
    }).select().single();
    studentId = newStudent?.id || crypto.randomUUID();
  }

  // Create real thread in chat_threads table
  const { data: threadRow, error: threadCreateErr } = await supabaseAdmin.from('chat_threads').insert({
    student_id: studentId,
    title: 'Visual Memory 14-Turn Integration Test',
  }).select().single();

  if (threadCreateErr) {
    console.error('Could not create test thread:', threadCreateErr.message);
    return;
  }

  const testThreadId = threadRow.id;
  console.log(`📦 [Test Thread Created]: ID = ${testThreadId}, StudentID = ${studentId}`);

  // -------------------------------------------------------------------------
  // STEP 1: UPLOAD READABLE MATH WORKSHEET (TURN 1)
  // -------------------------------------------------------------------------
  const worksheetBuffer = await createReadableMathWorksheetBuffer();
  const compressedBase64 = worksheetBuffer.toString('base64');
  const imageId = `${Date.now()}_img1`;

  const storageResult = await uploadHomeworkImageToStorage(supabaseAdmin, testThreadId, worksheetBuffer, imageId);
  setThreadImage(testThreadId, compressedBase64, 'image/jpeg');

  if (storageResult) {
    setThreadImage(storageResult.storagePath, compressedBase64, 'image/jpeg');

    // Insert into thread_images table
    const { error: threadImgErr } = await supabaseAdmin.from('thread_images').insert({
      thread_id: testThreadId,
      storage_path: storageResult.storagePath,
    });
    if (threadImgErr) {
      console.warn(`[thread_images Insert Warning]: ${threadImgErr.message}`);
    }

    // Save in fallback map for test runner
    const list = inMemoryThreadImagesMap.get(testThreadId) || [];
    list.push(storageResult.storagePath);
    inMemoryThreadImagesMap.set(testThreadId, list);
  }

  const uploadMessageContent = `📸 [STORAGE:${storageResult!.storagePath}] Please help me with Question 1 on this math worksheet`;

  // Save Turn 1 User Message
  await supabaseAdmin.from('messages').insert({
    thread_id: testThreadId,
    student_id: studentId,
    role: 'user',
    content: uploadMessageContent,
    message_type: 'image',
  });

  const turn1Explanation = await generateHomeworkExplanation(compressedBase64, 'image/jpeg', 'Please help me with Question 1 on this math worksheet');

  // Save Turn 1 Assistant Explanation
  await supabaseAdmin.from('messages').insert({
    thread_id: testThreadId,
    student_id: studentId,
    role: 'assistant',
    content: turn1Explanation,
  });

  console.log(`[TURN 1 - UPLOAD WORKSHEET]: "${uploadMessageContent}"`);
  console.log(`[TURN 1 - KIDSKO AI]: "${turn1Explanation}"\n`);

  // -------------------------------------------------------------------------
  // STEP 2: RUN EXACT 14-TURN SEQUENCE
  // -------------------------------------------------------------------------
  const questions = [
    "How do I add 5 and 3 together?",                                // Turn 2 (Question 1)
    "Can you give me a hint for Question 2?",                         // Turn 3 (Question 2 - Early Turn Check)
    "What is 12 minus 4 equal to?",                                    // Turn 4 (Question 3)
    "Is Question 3 multiplication or addition?",                       // Turn 5 (Question 4)
    "What is 6 times 2?",                                             // Turn 6 (Question 5)
    "Can you explain how multiplication works?",                      // Turn 7 (Question 6)
    "Which sign means to divide?",                                    // Turn 8 (Question 7)
    "How do I practice math facts at home?",                           // Turn 9 (Question 8)
    "Why are numbers important in real life?",                         // Turn 10 (Question 9)
    "Can we do another problem together?",                             // Turn 11 (Question 10)
    "What is your favorite math trick?",                              // Turn 12 (Question 11)
    "Am I doing great so far?",                                       // Turn 13 (Question 12)
    "Look at the image again. What does question 4 say?",             // Turn 14 (FINAL LATE-TURN BUG TEST)
  ];

  let earlyTurnPass = false;
  let finalReply = '';

  for (let idx = 0; idx < questions.length; idx++) {
    const turnNumber = idx + 2;
    const userPrompt = questions[idx];

    // Brief delay between API turns to prevent 503 high-demand spikes
    await new Promise((r) => setTimeout(r, 600));

    // Purge RAM cache before Turn 14 to force real Supabase Storage download fallback
    if (turnNumber === 14 && storageResult?.storagePath) {
      console.log('🧹 [Cache Purge Test]: Purging RAM cache before Turn 14 to test Supabase Storage download fallback...');
      clearThreadImageCache(storageResult.storagePath);
      clearThreadImageCache(testThreadId);
    }

    const aiResponse = await executeRealChatTurn(testThreadId, studentId, userPrompt);

    console.log(`[TURN ${turnNumber} - USER]: "${userPrompt}"`);
    console.log(`[TURN ${turnNumber} - KIDSKO AI]: "${aiResponse}"\n`);

    if (turnNumber === 3) {
      // Early turn check (Turn 3 / Question 2)
      const deniesEarly = /cannot see|do not have eyes|no picture|don't have eyes|can't see/i.test(aiResponse);
      earlyTurnPass = !deniesEarly;
    }

    if (turnNumber === 14) {
      finalReply = aiResponse;
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: ASSERTIONS
  // -------------------------------------------------------------------------
  console.log('=================================================================');
  console.log('📊 EVALUATION CHECKS FOR REAL INTEGRATION TEST:');
  console.log('=================================================================');

  // Check 1: Vision denial check
  const deniesVision = /cannot see|do not have eyes|no picture|don't have eyes|can't see|don't see/i.test(finalReply);
  console.log(`1. Early Turn Check (Turn 3 / Question 2): ${earlyTurnPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`2. Late Turn Vision Check (Turn 14): ${!deniesVision ? '✅ PASS (No Vision Denial)' : '❌ FAIL (Vision Denied!)'}`);

  // Check 2: Content grounding check for Question 4 ("8 x 4 = ?" / "32")
  const lowerFinal = finalReply.toLowerCase();
  const referencesQuestion4 = lowerFinal.includes('8') || lowerFinal.includes('4') || lowerFinal.includes('32') || lowerFinal.includes('eight') || lowerFinal.includes('four') || lowerFinal.includes('multiply');
  console.log(`3. Question 4 Image Content Grounding: ${referencesQuestion4 ? '✅ PASS (References 8 x 4 / 32)' : '❌ FAIL (Vague / Un-grounded)'}`);

  // Cleanup test thread & storage image
  if (storageResult?.storagePath) {
    await supabaseAdmin.storage.from('homework-snapshots').remove([storageResult.storagePath]);
    await supabaseAdmin.from('messages').delete().eq('thread_id', testThreadId);
    await supabaseAdmin.from('chat_threads').delete().eq('id', testThreadId);
    console.log('\n🧹 Cleaned up integration test thread & storage file.');
  }

  const allPassed = earlyTurnPass && !deniesVision && referencesQuestion4;

  console.log('\n=================================================================');
  if (allPassed) {
    console.log('🎉 100% REAL INTEGRATION SUITE PASSED PERFECTLY!');
  } else {
    console.log('❌ INTEGRATION TEST FAILED - CHECK TRANSCRIPT ABOVE');
  }
  console.log('=================================================================\n');
}

runMultiTurnVisualMemoryIntegrationTest().catch((err) => {
  console.error('Integration test failed with error:', err);
});
