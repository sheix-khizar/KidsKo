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
      let activeTurnId = 0;
      let pcmBuffer = Buffer.alloc(0);
      const TARGET_CHUNK_BYTES = 14400; // ~300ms PCM audio @ 24kHz 16-bit mono

      const flushPcmBuffer = (forceAll = false) => {
        while (pcmBuffer.length > 0) {
          if (!forceAll && pcmBuffer.length < TARGET_CHUNK_BYTES) {
            break;
          }
          const sendLen = forceAll ? pcmBuffer.length : Math.min(TARGET_CHUNK_BYTES, pcmBuffer.length);
          const chunkToSend = pcmBuffer.subarray(0, sendLen);
          pcmBuffer = pcmBuffer.subarray(sendLen);

          if (clientSocket.readyState === WebSocket.OPEN) {
            const base64Data = chunkToSend.toString('base64');
            console.log(`[Backend Outbound Aggregated Audio Chunk]: bytes=${base64Data.length} (~${Math.round(sendLen / 48)}ms PCM), turnId=${activeTurnId}`);
            clientSocket.send(JSON.stringify({ type: 'audio', data: base64Data, turnId: activeTurnId }));
          }
        }
      };

      const liveCallbacks = {
        onTextChunk: (text: string) => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'text', data: text }));
          }
        },
        onAudioChunk: (base64Audio: string) => {
          const incoming = Buffer.from(base64Audio, 'base64');
          pcmBuffer = Buffer.concat([pcmBuffer, incoming]);
          flushPcmBuffer(false);
        },
        onTurnComplete: () => {
          flushPcmBuffer(true);
          if (clientSocket.readyState === WebSocket.OPEN) {
            const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
            console.log(`[Backend Outbound turn_complete Frame]: Gemini turn complete. Session active for ${elapsedSec}s / ${capSeconds}s max. Client WS state=${clientSocket.readyState}, Gemini WS state=${liveSession?.readyState}, turnId=${activeTurnId}`);
            clientSocket.send(JSON.stringify({ type: 'turn_complete', turnId: activeTurnId }));
          }
        },
        onClose: async (reason?: string) => {
          console.log(`[Gemini Live WS Session Closed]: Reason=${reason || 'Normal close'}`);
          if (clientSocket.readyState === WebSocket.OPEN) {
            const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
            const reasonStr = reason || '';
            const isGoAwayOrLimit = reasonStr.includes('GoAway') || reasonStr.includes('session duration') || reasonStr.includes('Go Away');
            if (elapsedSec < capSeconds && isGoAwayOrLimit) {
              console.log('[Voice Socket]: Gemini WS closed due to Google duration limit (GoAway). Transparently auto-reconnecting Gemini Live WS...');
              try {
                liveSession = await startLiveSession(liveCallbacks);
                console.log('[Voice Socket]: Transparent Gemini Live WS auto-reconnect succeeded!');
                return;
              } catch (reconnectErr: any) {
                console.error('[Voice Socket]: Failed to auto-reconnect Gemini Live WS:', reconnectErr.message);
              }
            }
            console.log('[Voice Socket Close]: Forwarding Gemini session close to client with Code 1000');
            clientSocket.close(1000, reason || 'Gemini session ended');
          }
        },
        onError: (err: any) => {
          console.error('[Voice Socket] Gemini Live error:', err);
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'error', reason: typeof err === 'string' ? err : 'Voice session error' }));
          }
        },
      };

      try {
        liveSession = await startLiveSession(liveCallbacks);
      } catch (err: any) {
        console.error('[Voice Socket] Failed to start Gemini Live session:', err.message);
        clientSocket.close(1011, 'Could not start voice session');
        return;
      }

      clientSocket.send(JSON.stringify({ type: 'ready', capSeconds }));

      // 🎙️ Send initial personalized AI voice greeting upon call start
      let studentName = 'there';
      if (studentId) {
        try {
          const { data: s } = await dbClient.from('students').select('name').eq('id', studentId).maybeSingle();
          if (s && s.name) {
            studentName = s.name.trim();
          }
        } catch (err: any) {
          console.warn('[Voice Socket] Could not fetch student name for greeting:', err?.message);
        }
      }

      const greetingPrompt = `Hi ${studentName}, I am Kidsko. How can I help you today?`;
      console.log(`[Voice Server] Triggering initial AI voice greeting for ${studentName}: "${greetingPrompt}"`);
      sendTextPrompt(liveSession, greetingPrompt);

      accountingTimer = setInterval(async () => {
        try {
          elapsedMs += ACCOUNTING_INTERVAL_MS;
          const elapsedSec = Math.floor(elapsedMs / 1000);
          const remainingSec = Math.max(0, capSeconds - elapsedSec);
          console.log(`[Voice Accounting Check]: Elapsed=${elapsedSec}s, Remaining=${remainingSec}s, DB update (+${ACCOUNTING_INTERVAL_MS / 60000} min)`);
          await recordVoiceMinutesUsed(dbClient, parentId, ACCOUNTING_INTERVAL_MS / 60000);
        } catch (err) {
          console.error('[Voice Socket] Error recording voice minutes:', err);
        }
      }, ACCOUNTING_INTERVAL_MS);

      hardCapTimer = setTimeout(() => {
        const totalDurationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
        console.log(`[HARD CAP TIMER FIRED]: Reached maximum allowed cap (${totalDurationSec}s). Closing session with Code 4003.`);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'cap_reached' }));
        }
        closeLiveSession(liveSession);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.close(4003, 'Session time limit reached');
        }
      }, capMs);

      clientSocket.on('message', (raw) => {
        (async () => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'audio_chunk') {
              console.log('[Voice Server] Received chunk, bytes:', msg.data.length);
              if (msg.isRawPcm) {
                sendAudioChunk(liveSession, msg.data);
              }
            } else if (msg.type === 'interrupt') {
              activeTurnId = msg.turnId || (activeTurnId + 1);
              pcmBuffer = Buffer.alloc(0);
              console.log(`[Voice Server] User interrupt received, cancelled active audio buffer for turnId=${activeTurnId}`);
            } else if (msg.type === 'text_prompt') {
              activeTurnId = msg.turnId || (activeTurnId + 1);
              pcmBuffer = Buffer.alloc(0);
              const currentElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
              console.log(`[Voice Server User Turn Received]: Prompt="${msg.data}", turnId=${activeTurnId}, Elapsed=${currentElapsed}s / ${capSeconds}s, Gemini WS state=${liveSession?.readyState}`);
              sendTextPrompt(liveSession, msg.data);
            } else if (msg.type === 'image_capture') {
              activeTurnId = msg.turnId || (activeTurnId + 1);
              pcmBuffer = Buffer.alloc(0);
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

      clientSocket.on('close', async (code, reason) => {
        const totalSessionDurationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
        console.log(`[Client WebSocket Closed]: Code=${code}, Reason="${reason || 'Client disconnected'}", Total Session Duration=${totalSessionDurationSec}s`);
        clearInterval(accountingTimer);
        clearTimeout(hardCapTimer);
        const remainderMs = elapsedMs % ACCOUNTING_INTERVAL_MS;
        if (remainderMs > 0) {
          try {
            await recordVoiceMinutesUsed(dbClient, parentId, remainderMs / 60000);
          } catch {}
        }
        try {
          closeLiveSession(liveSession);
        } catch {
          // session already closed
        }
      });
    } catch (globalErr: any) {
      console.error('[Voice Socket] Connection handler exception:', globalErr.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1011, 'Server internal error');
      }
    }
  });

  return wss;
}
