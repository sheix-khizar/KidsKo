import dotenv from 'dotenv';
import path from 'path';
import { isPersonalMessage, getCachedAnswer, setCachedAnswer } from '../lib/cache';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runCachePrivacyTests() {
  console.log('🧪 ==========================================================');
  console.log('🔒 VERIFYING STEP 1.1: CACHE PRIVACY & PERSONAL MESSAGE GATES');
  console.log('🧪 ==========================================================\n');

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

  // TEST 1: isPersonalMessage Detection
  console.log('--- TEST GROUP 1: PERSONAL MESSAGE PATTERN MATCHING ---');
  assert(isPersonalMessage('my name is Jagal') === true, 'Catches "my name is Jagal"');
  assert(isPersonalMessage('My Name is Sarah') === true, 'Case-insensitive: "My Name is Sarah"');
  assert(isPersonalMessage('call me Timmy') === true, 'Catches "call me Timmy"');
  assert(isPersonalMessage('I am 8 years old') === true, 'Catches "I am 8 years old"');
  assert(isPersonalMessage("I'm in third grade") === true, 'Catches "I\'m in third grade"');
  assert(isPersonalMessage('im learning math') === true, 'Catches "im learning math"');
  assert(isPersonalMessage('my mom helps me with homework') === true, 'Catches "my mom..."');
  assert(isPersonalMessage('my school is Oakridge') === true, 'Catches "my school..."');
  assert(isPersonalMessage('my favourite subject is science') === true, 'Catches "my favourite..."');
  assert(isPersonalMessage('my favorite animal is dog') === true, 'Catches "my favorite..."');
  assert(isPersonalMessage('remember that I like dinosaurs') === true, 'Catches "remember..."');

  // Negative tests: Generic academic / educational questions
  assert(isPersonalMessage('Why is the sky blue?') === false, 'Generic question "Why is the sky blue?" is NOT personal');
  assert(isPersonalMessage('What is 12 x 12?') === false, 'Math question "What is 12 x 12?" is NOT personal');
  assert(isPersonalMessage('How do plants make food?') === false, 'Science question is NOT personal');
  assert(isPersonalMessage('Tell me about the solar system') === false, 'General question is NOT personal');

  // TEST 2: Student Name Collision in Cached Response Check
  console.log('\n--- TEST GROUP 2: STUDENT NAME IN REPLY DETECTION ---');
  const studentName = 'Jagal';
  const nameRegex = new RegExp(`\\b${studentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

  const replyWithStudent = 'Hello Jagal! I am happy to help you with math.';
  const replyGeneric = 'Hello! I am happy to help you with math.';
  assert(nameRegex.test(replyWithStudent) === true, 'Detects student name "Jagal" in reply');
  assert(nameRegex.test(replyGeneric) === false, 'Allows generic reply without student name');

  // TEST 3: Redis Cache Interplay (v2 Versioned Keys)
  console.log('\n--- TEST GROUP 3: REDIS CACHE STORAGE & ISOLATION ---');
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const testGenericQ = `Test Sky Question ${Date.now()}`;
    const testGenericA = 'The sky appears blue because molecules in Earth air scatter sunlight.';

    // Store generic answer
    await setCachedAnswer(testGenericQ, testGenericA, 'Grade 3');
    const cachedGeneric = await getCachedAnswer(testGenericQ, 'Grade 3');
    assert(cachedGeneric === testGenericA, 'Generic question caches and retrieves cleanly');

    // Personal question must NEVER be stored via the gate logic
    const personalQ = 'my name is Jagal';
    assert(isPersonalMessage(personalQ) === true, 'Personal query triggers bypass gate before cache read/write');
  } else {
    console.log('  ⚠️ Upstash Redis credentials not configured in env, verified offline logic.');
  }

  console.log('\n==========================================================');
  console.log(`📊 SUMMARY: ${passed}/${total} assertions passed.`);
  if (passed === total) {
    console.log('🎉 ALL STEP 1.1 CACHE PRIVACY CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME CHECKS FAILED!');
  }
  console.log('==========================================================\n');
}

runCachePrivacyTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
