import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { startLiveSession, sendImagePrompt, sendTextPrompt } from '../lib/geminiLive';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testLiveImage() {
  console.log('🧪 Testing Gemini Live Image Prompt Response...');
  
  // Create dummy JPEG
  const dummyJpeg = await sharp({
    create: { width: 300, height: 300, channels: 3, background: { r: 200, g: 200, b: 200 } }
  }).jpeg().toBuffer();
  const base64Jpeg = dummyJpeg.toString('base64');

  let receivedAudioChunks = 0;
  let receivedTextChunks = 0;

  try {
    const ws = await startLiveSession({
      onAudioChunk: (chunk) => {
        receivedAudioChunks++;
        console.log(`🎵 [AUDIO CHUNK #${receivedAudioChunks}] bytes:`, chunk.length);
      },
      onTextChunk: (text) => {
        receivedTextChunks++;
        console.log(`📝 [TEXT CHUNK #${receivedTextChunks}]:`, text);
      },
      onTurnComplete: () => {
        console.log(`✅ [TURN COMPLETE]: Audio chunks = ${receivedAudioChunks}, Text chunks = ${receivedTextChunks}`);
      },
      onClose: (reason) => {
        console.log('❌ [SESSION CLOSED]:', reason);
      },
      onError: (err) => {
        console.error('❌ [SESSION ERROR]:', err);
      }
    });

    console.log('Connected to Gemini Live! Waiting 2 seconds then sending image...');
    setTimeout(() => {
      console.log('Sending sendImagePrompt...');
      sendImagePrompt(ws, base64Jpeg, 'Please look at this image and tell me what color it is.');
    }, 2000);

    setTimeout(() => {
      console.log('Test finished. Closing WS.');
      ws.close();
      process.exit(0);
    }, 15000);
  } catch (err: any) {
    console.error('Exception:', err.message);
  }
}

testLiveImage();
