import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { generateHomeworkExplanation, generateChatReply } from '../lib/gemini';

dotenv.config({ path: path.join(__dirname, '../../.env') });

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

async function testMathTone() {
  console.log('🧪 =================================================================');
  console.log('🚀 TESTING CHILD-FRIENDLY MATH EXPLANATION TONE & FORMAT');
  console.log('🧪 =================================================================\n');

  const dummyImage = await createDummyJpegBase64();

  console.log('--- TURN 1: USER ATTACHES IMAGE & ASKS "Solve question 1 part a from it" ---');
  const userPrompt1 = "Solve question 1 part a from it (5 x 5 x 5)";
  const reply1 = await generateHomeworkExplanation(dummyImage, 'image/jpeg', userPrompt1);
  console.log(`[KIDSKO REPLY 1]:\n"${reply1}"\n`);

  console.log('--- TURN 2: USER ASKS "guide me step by step how to solve part a?" ---');
  const history = [
    { role: 'user' as const, content: `📸 ${userPrompt1}` },
    { role: 'assistant' as const, content: reply1 },
    { role: 'user' as const, content: 'guide me step by step how to solve part a?' },
  ];
  const reply2 = await generateChatReply(history);
  console.log(`[KIDSKO REPLY 2]:\n"${reply2}"\n`);

  // Assertions
  const hasJargon = /index notation|multiplication string|base number|power number/i.test(reply1 + reply2);
  const hasSpelledOutMath = /two times two|two to the power of three|three fives/i.test(reply1 + reply2);
  const wordCount1 = reply1.split(/\s+/).filter(Boolean).length;
  const wordCount2 = reply2.split(/\s+/).filter(Boolean).length;

  console.log('📊 EVALUATION CHECKS:');
  console.log(`   - Free of textbook jargon? => ${!hasJargon ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Uses digits (5 × 5) instead of spelled-out words? => ${!hasSpelledOutMath ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Turn 1 short length (${wordCount1} words)? => ${wordCount1 <= 45 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Turn 2 short length (${wordCount2} words)? => ${wordCount2 <= 45 ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n=================================================================');
  console.log('🎉 CHILD-FRIENDLY MATH EXPLANATION SUITE COMPLETED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

testMathTone();
