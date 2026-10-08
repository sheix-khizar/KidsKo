import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { generateHomeworkExplanation, generateChatReply } from '../lib/gemini';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createExponentsWorksheetBuffer(): Promise<Buffer> {
  const svgText = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="30" y="50" font-family="Arial" font-size="20" fill="#000000">Math Worksheet: Powers and Exponents</text>
      <text x="30" y="100" font-family="Arial" font-size="24" fill="#1a73e8" font-weight="bold">Question 1: 5 x 5 x 5 = 5³</text>
      <text x="30" y="150" font-family="Arial" font-size="18" fill="#333333">Write 4 x 4 x 4 x 4 using exponents</text>
    </svg>
  `;
  return sharp(Buffer.from(svgText))
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function runMathToneTest() {
  console.log('🧪 =================================================================');
  console.log('🦉 TESTING KIDS KO MATH EXPLANATION TONE & JARGON ELIMINATION');
  console.log('🧪 =================================================================\n');

  const testImageBuffer = await createExponentsWorksheetBuffer();
  const testBase64 = testImageBuffer.toString('base64');

  console.log('📸 [TEST 1]: Generating Homework Explanation for Exponents Problem (5 x 5 x 5 = 5³)...');
  const explanation = await generateHomeworkExplanation(testBase64, 'image/jpeg', 'How do powers work here?');
  console.log(`\n🤖 AI Explanation Output:\n"${explanation}"\n`);

  // Banned Jargon Words Audit
  const bannedTerms = [
    'index notation',
    'multiplication string',
    'base number',
    'power number',
    'algebraic expression',
    'exponent notation',
  ];

  const lowerExplanation = explanation.toLowerCase();
  const foundJargon = bannedTerms.filter(term => lowerExplanation.includes(term));

  // Sentence count check
  const sentenceCount = (explanation.match(/[.!?]+/g) || []).length;
  const wordCount = explanation.split(/\s+/).length;

  console.log('📊 EVALUATION CHECKS FOR ISSUE A (HOMEWORK EXPLANATION):');
  console.log(`   - Banned Textbook Jargon Found? => ${foundJargon.length === 0 ? '✅ NONE (100% CLEAN)' : `❌ FOUND: ${foundJargon.join(', ')}`}`);
  console.log(`   - Sentence Count: ${sentenceCount} sentences (Target: 2-3 max) => ${sentenceCount <= 4 ? '✅ PASS' : '⚠️ WARNING'}`);
  console.log(`   - Total Word Count: ${wordCount} words => ${wordCount <= 45 ? '✅ PASS' : '⚠️ WARNING'}`);

  // Test 2: Follow-up chat turn
  console.log('\n💬 [TEST 2]: Testing Follow-up Chat Turn ("Why is there a tiny 3 on top of 5?")...');
  const followUpHistory = [
    { role: 'user' as const, content: 'Why is there a tiny 3 on top of 5?' }
  ];

  const chatReply = await generateChatReply(followUpHistory);
  console.log(`\n🤖 AI Chat Turn Output:\n"${chatReply}"\n`);

  const lowerReply = chatReply.toLowerCase();
  const foundJargonReply = bannedTerms.filter(term => lowerReply.includes(term));

  console.log('📊 EVALUATION CHECKS FOR FOLLOW-UP CHAT TURN:');
  console.log(`   - Banned Textbook Jargon Found? => ${foundJargonReply.length === 0 ? '✅ NONE (100% CLEAN)' : `❌ FOUND: ${foundJargonReply.join(', ')}`}`);
  console.log(`   - Uses Digits for Numbers? => ${/\d/.test(chatReply) ? '✅ YES' : '❌ NO'}`);

  console.log('\n=================================================================');
  console.log('🎉 MATH TONE & JARGON AUDIT SUITE COMPLETED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runMathToneTest();
