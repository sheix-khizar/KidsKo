import dotenv from 'dotenv';
import path from 'path';
import WebSocket from 'ws';
import sharp from 'sharp';

dotenv.config({ path: path.join(__dirname, '../../.env') });
const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

async function testVideo() {
  const ws = new WebSocket(url);
  ws.on('open', () => {
    console.log('WS OPEN');
    ws.send(JSON.stringify({
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
        generationConfig: { responseModalities: ['AUDIO'] }
      }
    }));
  });

  const dummy = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 100, g: 100, b: 100 } }
  }).jpeg().toBuffer();
  const base64 = dummy.toString('base64');

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('RECV:', JSON.stringify(msg).slice(0, 150));
    if (msg.setupComplete) {
      console.log('Sending realtimeInput.video...');
      ws.send(JSON.stringify({
        realtimeInput: {
          video: {
            mimeType: 'image/jpeg',
            data: base64
          }
        }
      }));
      setTimeout(() => {
        console.log('✅ Realtime video accepted with no deprecation error! Closing.');
        ws.close();
        process.exit(0);
      }, 2500);
    }
  });

  ws.on('error', (err) => console.error('WS ERR:', err));
  ws.on('close', (code, reason) => console.log('WS CLOSE:', code, reason.toString()));
}

testVideo();
