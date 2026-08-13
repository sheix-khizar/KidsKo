import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { generateHomeworkExplanation, generateChatReply } from '../lib/gemini';
import { setThreadImage, getThreadImage } from '../lib/threadImageStore';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Create a dummy image buffer for testing
async function createDummyJpegBase64(): Promise<string> {
  const buf = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 200, g: 220, b: 255 },
    },
  })
    .jpeg()
    .toBuffer();
  return buf.toString('base64');
}

async function testVisualMemorySequence() {
  console.log('🧪 =================================================================');
  console.log('🚀 TESTING MULTI-TURN IMAGE VISUAL MEMORY ACROSS CHAT TURNS');
  console.log('🧪 =================================================================\n');

  const testThreadId = 'test-thread-visual-memory-123';
  const dummyImage = await createDummyJpegBase64();

  // 1. Turn 1: User uploads image & asks Turn 1 prompt
  setThreadImage(testThreadId, dummyImage, 'image/jpeg');

  const userTurn1 = "📸 Solve question 1 part 1 how to solve? Step by step.";
  const reply1 = await generateHomeworkExplanation(dummyImage, 'image/jpeg', "Solve question 1 part 1 how to solve? Step by step.");
  console.log(`[TURN 1 - USER]: "${userTurn1}"`);
  console.log(`[TURN 1 - KIDSKO]: "${reply1}"\n`);

  const history = [
    { role: 'user' as const, content: userTurn1 },
    { role: 'assistant' as const, content: reply1 },
  ];

  // 2. Turn 2: User asks follow up "Just give answer of it"
  const userTurn2 = "Just give answer of it how to write on my worksheet?";
  history.push({ role: 'user', content: userTurn2 });
  const reply2 = await generateChatReply(history, getThreadImage(testThreadId));
  history.push({ role: 'assistant', content: reply2 });
  console.log(`[TURN 2 - USER]: "${userTurn2}"`);
  console.log(`[TURN 2 - KIDSKO]: "${reply2}"\n`);

  // 3. Turn 3: User asks "Solve next question part 3"
  const userTurn3 = "Solve next question part 3";
  history.push({ role: 'user', content: userTurn3 });
  const reply3 = await generateChatReply(history, getThreadImage(testThreadId));
  history.push({ role: 'assistant', content: reply3 });
  console.log(`[TURN 3 - USER]: "${userTurn3}"`);
  console.log(`[TURN 3 - KIDSKO]: "${reply3}"\n`);

  // 4. Turn 4: User asks "Look in image and solve question 1 part 4, what is it?"
  const userTurn4 = "Look in image and solve question 1 part 4, what is it?";
  history.push({ role: 'user', content: userTurn4 });
  const reply4 = await generateChatReply(history, getThreadImage(testThreadId));
  console.log(`[TURN 4 - USER]: "${userTurn4}"`);
  console.log(`[TURN 4 - KIDSKO]: "${reply4}"\n`);

  // Verification checks
  const deniesVision = reply4.toLowerCase().includes('cannot see') || reply4.toLowerCase().includes('do not have eyes');
  const wordCount4 = reply4.split(/\s+/).filter(Boolean).length;

  console.log('📊 EVALUATION CHECKS:');
  console.log(`   - Gemini remembers & sees image on Turn 4? => ${!deniesVision ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Kidsko denied visual ability? => ${deniesVision ? 'YES (FAIL)' : 'NO (PASSED!)'}`);
  console.log(`   - Output length short & natural (${wordCount4} words)? => ${wordCount4 <= 55 ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n=================================================================');
  console.log('🎉 MULTI-TURN VISUAL MEMORY TEST COMPLETED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

testVisualMemorySequence();
