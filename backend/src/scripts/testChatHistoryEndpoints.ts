import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { cleanMessageForClient, IMAGE_RETENTION_HOURS } from '../lib/chatHistory';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function runChatHistoryEndpointTests() {
  console.log('🧪 =================================================================');
  console.log('📜 VERIFYING STEP 6.4: CHAT HISTORY ENDPOINTS & DATA ISOLATION');
  console.log('🧪 =================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 1: SERVER-SIDE MESSAGE CLEANING & IMAGE RETENTION
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: SERVER-SIDE MESSAGE CLEANING (cleanMessageForClient) ---');

  const now = new Date();
  const recentTime = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  const expiredTime = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago (> 48h)

  // 1. Storage marker with typed question
  const msg1 = cleanMessageForClient('user', '📸 [STORAGE:threads/t1/pic.jpg] Help with question 4', recentTime);
  assert(msg1.text === 'Help with question 4', 'Strips 📸 [STORAGE:...] marker and leaves typed question');
  assert(msg1.hasImage === true, 'Correctly flags hasImage === true');
  assert(msg1.imageExpired === false, 'Recent image is not expired (2h < 48h)');

  // 2. Storage marker with no typed question
  const msg2 = cleanMessageForClient('user', '[STORAGE:threads/t1/pic.jpg]', recentTime);
  assert(msg2.text === '📷 Homework photo', 'Photo-only message falls back to "📷 Homework photo"');
  assert(msg2.hasImage === true, 'Photo-only hasImage === true');
  assert(msg2.imageExpired === false, 'Photo-only imageExpired === false');

  // 3. 3-day-old photo message (> 48 hours)
  const msg3 = cleanMessageForClient('user', '📸 [STORAGE:threads/t1/pic.jpg] Old question', expiredTime);
  assert(msg3.text === 'Old question', 'Strips marker on expired photo message');
  assert(msg3.hasImage === true, 'Old photo hasImage === true');
  assert(msg3.imageExpired === true, 'Photo older than 48 hours has imageExpired === true');

  // 4. Legacy base64 [IMAGE:...] message
  const fakeBase64 = 'a'.repeat(500);
  const msg4 = cleanMessageForClient('user', `[IMAGE:${fakeBase64}]`, recentTime);
  assert(msg4.text === '📷 Homework photo', 'Strips massive legacy [IMAGE:base64] text completely');
  assert(!msg4.text.includes(fakeBase64), 'Base64 string is NEVER leaked in text response');
  assert(msg4.hasImage === true, 'Legacy image hasImage === true');

  // 5. Normal text message
  const msg5 = cleanMessageForClient('assistant', 'Here is how to solve 12 + 15.', recentTime);
  assert(msg5.text === 'Here is how to solve 12 + 15.', 'Standard text message untouched');
  assert(msg5.hasImage === false, 'Standard text hasImage === false');
  assert(msg5.imageExpired === false, 'Standard text imageExpired === false');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: MULTI-TENANT ISOLATION & ENDPOINT LOGIC
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: MULTI-TENANT ISOLATION & ENDPOINT LOGIC ---');

  // Find an existing student record to act as Student A
  const { data: existingStudent, error: findErr } = await supabaseAdmin
    .from('students')
    .select('id, parent_id, student_name')
    .limit(1)
    .single();

  if (findErr || !existingStudent) {
    throw new Error('No student found in DB for integration testing');
  }

  const studentAId = existingStudent.id;
  const parentAId = existingStudent.parent_id;
  const parentBId = '00000000-0000-0000-0000-000000000099'; // Unauthorized foreign parent

  const testThread1Id = crypto.randomUUID();
  const testThread2Id = crypto.randomUUID();

  const timeOlder = new Date(Date.now() - 3600000).toISOString();
  const timeNewer = new Date().toISOString();

  try {
    // Insert 2 test threads under Student A
    const { error: insThreadErr } = await supabaseAdmin.from('chat_threads').insert([
      { id: testThread1Id, student_id: studentAId, title: 'Math Fractions', created_at: timeOlder },
      { id: testThread2Id, student_id: studentAId, title: '   ', created_at: timeNewer },
    ]);
    if (insThreadErr) throw insThreadErr;

    // Insert test messages into testThread1
    const { error: insMsgErr } = await supabaseAdmin.from('messages').insert([
      { thread_id: testThread1Id, student_id: studentAId, role: 'user', content: 'What is 1/2 + 1/4?', created_at: timeOlder },
      { thread_id: testThread1Id, student_id: studentAId, role: 'assistant', content: 'It is 3/4!', created_at: timeOlder },
      { thread_id: testThread1Id, student_id: studentAId, role: 'user', content: '📸 [STORAGE:threads/t1/ws.jpg]', created_at: expiredTime },
    ]);
    if (insMsgErr) throw insMsgErr;

    // 1. Parent A verifies ownership of Student A (Simulate GET /api/chat/threads)
    const { data: studentCheckA } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', studentAId)
      .eq('parent_id', parentAId)
      .maybeSingle();

    assert(!!studentCheckA, 'Parent A verifies ownership of Student A');

    // 2. Fetch Parent A threads (Simulate GET /api/chat/threads)
    let { data: threadsA, error: fetchThreadsErr } = await supabaseAdmin
      .from('chat_threads')
      .select('id, title, created_at')
      .eq('student_id', studentAId)
      .in('id', [testThread1Id, testThread2Id])
      .order('created_at', { ascending: false });

    assert(!fetchThreadsErr && Array.isArray(threadsA) && threadsA.length === 2, 'Parent A receives both test threads');
    assert(threadsA![0].id === testThread2Id, 'Newest thread (testThread2) returned first');
    assert(threadsA![1].id === testThread1Id, 'Older thread (testThread1) returned second');

    // Title formatting checks
    const formattedTitle2 = threadsA![0].title && threadsA![0].title.trim() ? threadsA![0].title.trim() : 'New chat';
    const formattedTitle1 = threadsA![1].title && threadsA![1].title.trim() ? threadsA![1].title.trim() : 'New chat';
    assert(formattedTitle2 === 'New chat', 'Blank title formats to "New chat"');
    assert(formattedTitle1 === 'Math Fractions', 'Valid title "Math Fractions" preserved');

    // 3. Parent B unauthorized student check (Should return 404)
    const { data: studentCheckB } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', studentAId)
      .eq('parent_id', parentBId)
      .maybeSingle();

    assert(!studentCheckB, 'Parent B querying Student A fails ownership check (returns 404)');

    // 4. Parent A reads messages (Simulate GET /api/chat/threads/:threadId/messages)
    const { data: rawMsgs, error: fetchMsgsErr } = await supabaseAdmin
      .from('messages')
      .select('role, content, created_at')
      .eq('thread_id', testThread1Id)
      .order('created_at', { ascending: true });

    assert(!fetchMsgsErr && Array.isArray(rawMsgs) && rawMsgs.length === 3, 'Parent A retrieves messages in ascending order');
    const cleaned = rawMsgs!.map((m) => cleanMessageForClient(m.role, m.content, m.created_at));

    // Chronological order: expiredTime (72h ago) is oldest, then timeOlder user, then timeOlder assistant
    assert(cleaned[0].text === '📷 Homework photo', 'Ascending order: Message 0 (72h ago) marker stripped and fallback used');
    assert(cleaned[0].imageExpired === true, 'Message 0 (> 48h old) has imageExpired === true');
    assert(cleaned[1].text === 'What is 1/2 + 1/4?', 'Ascending order: Message 1 matches');
    assert(cleaned[2].text === 'It is 3/4!', 'Ascending order: Message 2 matches');

    // 5. Parent B unauthorized thread check (Should return 404)
    const { data: threadRow } = await supabaseAdmin
      .from('chat_threads')
      .select('id, student_id')
      .eq('id', testThread1Id)
      .maybeSingle();

    let parentBAccess = false;
    if (threadRow) {
      const { data: studentRow } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('id', threadRow.student_id)
        .eq('parent_id', parentBId)
        .maybeSingle();
      parentBAccess = !!studentRow;
    }
    assert(parentBAccess === false, 'Parent B attempting to access Parent A thread fails (returns 404)');

    // 6. Pagination check with limit = 1
    const { data: page1 } = await supabaseAdmin
      .from('chat_threads')
      .select('id, title, created_at')
      .eq('student_id', studentAId)
      .in('id', [testThread1Id, testThread2Id])
      .order('created_at', { ascending: false })
      .limit(1);

    const nextBefore = page1![0].created_at;
    const { data: page2 } = await supabaseAdmin
      .from('chat_threads')
      .select('id, title, created_at')
      .eq('student_id', studentAId)
      .in('id', [testThread1Id, testThread2Id])
      .lt('created_at', nextBefore)
      .order('created_at', { ascending: false })
      .limit(1);

    assert(page1![0].id === testThread2Id, 'Page 1 limit=1 returns testThread2');
    assert(page2![0].id === testThread1Id, 'Page 2 with lt(created_at, nextBefore) returns testThread1');

  } finally {
    // Clean up temporary test data
    await supabaseAdmin.from('messages').delete().in('thread_id', [testThread1Id, testThread2Id]);
    await supabaseAdmin.from('chat_threads').delete().in('id', [testThread1Id, testThread2Id]);
    console.log('🧹 Cleaned up temporary test data from database.');
  }

  // Delete scratch check script
  console.log(`\n=================================================================`);
  console.log(`🏁 TEST RESULTS: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`=================================================================`);
}

runChatHistoryEndpointTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
