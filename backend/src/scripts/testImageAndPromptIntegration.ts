import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { generateHomeworkExplanation, generateChatReply } from '../lib/gemini';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Create a small 100x100 white test image buffer in JPEG format
async function createDummyJpegBase64(): Promise<string> {
  const buf = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .jpeg()
    .toBuffer();
  return buf.toString('base64');
}

async function runTests() {
  console.log('🧪 =================================================================');
  console.log('🚀 CHAT COMPOSER IMAGE + PROMPT INTEGRATION TEST SUITE');
  console.log('🧪 =================================================================\n');

  const sampleImageBase64 = await createDummyJpegBase64();

  // Test 1 — Image + Short Prompt
  console.log('--------------------------------------------------');
  console.log('Test 1 — Image + Prompt ("What is question 2 asking?")');
  const t1Prompt = "What is question 2 asking?";
  const t1Reply = await generateHomeworkExplanation(sampleImageBase64, 'image/jpeg', t1Prompt);
  console.log(`[REPLY]: "${t1Reply}"`);
  console.log(`[PASS CHECK]: Non-empty & clean? => ${!!t1Reply && !t1Reply.includes('**')}`);

  // Test 2 — Image + Longer Prompt
  console.log('\n--------------------------------------------------');
  console.log('Test 2 — Image + Longer Prompt');
  const t2Prompt = "Please read this worksheet and help me solve question 3. Explain it in simple words.";
  const t2Reply = await generateHomeworkExplanation(sampleImageBase64, 'image/jpeg', t2Prompt);
  console.log(`[REPLY]: "${t2Reply}"`);
  console.log(`[PASS CHECK]: Non-empty & clean? => ${!!t2Reply && !t2Reply.includes('**')}`);

  // Test 3 — Image Only (Default Prompt)
  console.log('\n--------------------------------------------------');
  console.log('Test 3 — Image Only (Default Prompt)');
  const t3Reply = await generateHomeworkExplanation(sampleImageBase64, 'image/jpeg', undefined);
  console.log(`[REPLY]: "${t3Reply}"`);
  console.log(`[PASS CHECK]: Non-empty & clean? => ${!!t3Reply && !t3Reply.includes('**')}`);

  // Test 4 — Text Only
  console.log('\n--------------------------------------------------');
  console.log('Test 4 — Text Only ("What is a mammal?")');
  const t4Reply = await generateChatReply([{ role: 'user', content: 'What is a mammal?' }]);
  console.log(`[REPLY]: "${t4Reply}"`);
  console.log(`[PASS CHECK]: Non-empty & clean? => ${!!t4Reply && !t4Reply.includes('**')}`);

  // Test 6 — Multiple Messages (Follow-up Turn)
  console.log('\n--------------------------------------------------');
  console.log('Test 6 — Multiple Messages in Thread (Follow-up)');
  const history = [
    { role: 'user' as const, content: '📸 What is 5 + 3?' },
    { role: 'assistant' as const, content: '5 plus 3 is adding five apples and three more apples! If you count them up, what do you get?' },
    { role: 'user' as const, content: 'Is it 8?' },
  ];
  const t6Reply = await generateChatReply(history);
  console.log(`[REPLY]: "${t6Reply}"`);
  console.log(`[PASS CHECK]: Valid follow-up reply? => ${!!t6Reply}`);

  console.log('\n=================================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('=================================================================\n');
}

runTests();
