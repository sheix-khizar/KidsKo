import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import sharp from 'sharp';
import { supabase, supabaseAdmin } from './supabase';
import { checkVoiceEligibility, recordVoiceMinutesUsed, checkSnapshotEligibility, recordSnapshotUsed } from './voiceLimits';
import { startLiveSession, sendAudioChunk, sendTextPrompt, sendImagePrompt, closeLiveSession } from './geminiLive';
import { logUsageEvent } from './usageEvents';

const ACCOUNTING_INTERVAL_MS = 10_000;

export function attachVoiceSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/voice' });

  wss.on('connection', async (clientSocket: WebSocket, req) => {
    const sessionStartTime = Date.now();
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      const studentId = url.searchParams.get('studentId');

      if (!token) {
        console.log('[Voice Socket Close]: Code 4001 - Missing auth token');
        clientSocket.close(4001, 'Missing auth token');
        return;
      }

      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !userData.user) {
        console.log('[Voice Socket Close]: Code 4001 - Invalid auth token');
        clientSocket.close(4001, 'Invalid auth token');
        return;
      }
      const parentId = userData.user.id;

      const dbClient = supabaseAdmin || supabase;
      const eligibility = await checkVoiceEligibility(dbClient, parentId);
      if (!eligibility.allowed) {
        console.log(`[Voice Socket Close]: Code 4002 - Voice limit reached (${eligibility.reason})`);
        clientSocket.send(JSON.stringify({ type: 'error', reason: eligibility.reason }));
        clientSocket.close(4002, 'Voice limit reached');
        return;
      }

      const capMinutes = eligibility.isPremium
        ? eligibility.minutesRemaining
        : Math.min(30, eligibility.minutesRemaining);
      const capMs = Math.max(1000, capMinutes * 60 * 1000);
      const capSeconds = Math.floor(capMs / 1000);

      console.log(`[Voice Session Started]: ParentId=${parentId}, StudentId=${studentId || '(none)'}, CapMinutes=${capMinutes.toFixed(2)}, CapSeconds=${capSeconds}s, StartTime=${new Date(sessionStartTime).toISOString()}`);

      let liveSession: any;
      let elapsedMs = 0;
      let accountingTimer: NodeJS.Timeout;
      let hardCapTimer: NodeJS.Timeout;

      try {
        liveSession = await startLiveSession({
          onTextChunk: (text) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({ type: 'text', data: text }));
            }
          },
          onAudioChunk: (base64Audio) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              console.log(`[Backend Outbound Audio Chunk to Mobile]: bytes=${base64Audio.length}`);
              clientSocket.send(JSON.stringify({ type: 'audio', data: base64Audio }));
            }
          },
          onTurnComplete: () => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
              console.log(`[Backend Outbound turn_complete Frame]: Gemini turn complete. Session active for ${elapsedSec}s / ${capSeconds}s max. Client WS state=${clientSocket.readyState}, Gemini WS state=${liveSession?.readyState}`);
              clientSocket.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onClose: (reason) => {
            console.log(`[Gemini Live WS Session Closed]: Reason=${reason || 'Normal close'}`);
            if (clientSocket.readyState === WebSocket.OPEN) {
              console.log('[Voice Socket Close]: Forwarding Gemini session close to client with Code 1000');
              clientSocket.close(1000, reason || 'Gemini session ended');
            }
          },
          onError: (err) => {
            console.error('[Voice Socket] Gemini Live error:', err);
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({ type: 'error', reason: typeof err === 'string' ? err : 'Voice session error' }));
            }
          },
        });
      } catch (err: any) {
        console.error('[Voice Socket] Failed to start Gemini Live session:', err.message);
        clientSocket.close(1011, 'Could not start voice session');
        return;
      }

      clientSocket.send(JSON.stringify({ type: 'ready', capSeconds }));

      // Send fast, crisp initial personalized AI voice greeting upon call start
      let studentName = 'there';
      if (studentId) {
        try {
          const { data: student } = await dbClient
            .from('students')
            .select('name')
            .eq('id', studentId)
            .single();
          if (student?.name) {
            studentName = student.name.split(' ')[0];
          }
        } catch (err) {
          console.warn('[Voice Socket] Could not fetch student name for greeting:', err);
        }
      }

      const greetingPrompt = `Greet ${studentName} naturally with 5 words max: "Hi ${studentName}! Ready to learn?"`;
      console.log(`[Voice Socket] Triggering initial AI voice greeting for ${studentName}: "${greetingPrompt}"`);
      sendTextPrompt(liveSession, greetingPrompt);

      // Periodic 10-second usage accounting timer
      accountingTimer = setInterval(async () => {
        elapsedMs += ACCOUNTING_INTERVAL_MS;
        const minutesToDeduct = ACCOUNTING_INTERVAL_MS / (60 * 1000);
        try {
          await recordVoiceMinutesUsed(dbClient, parentId, minutesToDeduct);
        } catch (err) {
          console.error('[Voice Socket] Error recording voice minutes:', err);
        }
      }, ACCOUNTING_INTERVAL_MS);

      // Hard-cap timer based on available balance
      hardCapTimer = setTimeout(() => {
        console.log(`[Voice Session Hard Cap Reached]: ${capMinutes.toFixed(2)} minutes exhausted for Parent ${parentId}`);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'cap_reached' }));
          clientSocket.close(4003, 'Voice cap reached');
        }
      }, capMs);

      // Inbound message handler from client
      clientSocket.on('message', (raw) => {
        (async () => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'audio_chunk') {
              console.log('[Voice Server] Received chunk, bytes:', msg.data.length);
              if (msg.isRawPcm) {
                sendAudioChunk(liveSession, msg.data);
              }
            } else if (msg.type === 'text_prompt' || msg.type === 'user_text_prompt') {
              const promptText = msg.data || msg.text || '';
              const currentElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
              console.log(`[Voice Server User Turn Received]: Prompt="${promptText}", Elapsed=${currentElapsed}s / ${capSeconds}s, Gemini WS state=${liveSession?.readyState}`);
              sendTextPrompt(liveSession, promptText);
            } else if (msg.type === 'image_capture') {
              const snapshotEligibility = await checkSnapshotEligibility(dbClient, parentId, eligibility.isPremium);
              if (!snapshotEligibility.allowed) {
                console.log(`[Voice Server Snapshot Blocked]: ${snapshotEligibility.reason}`);
                clientSocket.send(JSON.stringify({ type: 'snapshot_error', reason: snapshotEligibility.reason }));
                return;
              }

              const rawBuffer = Buffer.from(msg.data, 'base64');
              const compressedBuffer = await sharp(rawBuffer)
                .resize({ width: 768, height: 768, fit: 'inside' })
                .jpeg({ quality: 65, progressive: true })
                .toBuffer();
              const compressedBase64 = compressedBuffer.toString('base64');

              console.log('[Voice Server] Injecting captured photo into live session, caption:', msg.caption || '(none)');
              sendImagePrompt(liveSession, compressedBase64, msg.caption);
              await recordSnapshotUsed(dbClient, parentId);
              if (studentId) await logUsageEvent(dbClient, parentId, studentId, 'live_snapshot');

              clientSocket.send(JSON.stringify({ type: 'snapshot_ack', remaining: snapshotEligibility.remaining - 1 }));
            }
          } catch (err: any) {
            console.error('[Voice Socket] Bad client message or snapshot processing error:', err.message);
            clientSocket.send(JSON.stringify({ type: 'snapshot_error', reason: 'Could not process that photo.' }));
          }
        })();
      });

      clientSocket.on('close', () => {
        const totalDurationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
        console.log(`[Voice Session Ended]: ParentId=${parentId}, TotalDuration=${totalDurationSec}s`);
        clearInterval(accountingTimer);
        clearTimeout(hardCapTimer);
        closeLiveSession(liveSession);
      });

      clientSocket.on('error', (err) => {
        console.error('[Voice Socket] Client connection error:', err);
        clearInterval(accountingTimer);
        clearTimeout(hardCapTimer);
        closeLiveSession(liveSession);
      });
    } catch (err: any) {
      console.error('[Voice Session Initialization Error]:', err.message);
      clientSocket.close(1011, 'Voice session initialization failed');
    }
  });
}
