import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { supabase, supabaseAdmin } from './supabase';
import { checkVoiceEligibility, recordVoiceMinutesUsed } from './voiceLimits';
import { startLiveSession, sendAudioChunk, sendTextPrompt, closeLiveSession } from './geminiLive';

const ACCOUNTING_INTERVAL_MS = 10_000;

export function attachVoiceSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/voice' });

  wss.on('connection', async (clientSocket: WebSocket, req) => {
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        clientSocket.close(4001, 'Missing auth token');
        return;
      }

      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !userData.user) {
        clientSocket.close(4001, 'Invalid auth token');
        return;
      }
      const parentId = userData.user.id;

      const dbClient = supabaseAdmin || supabase;
      const eligibility = await checkVoiceEligibility(dbClient, parentId);
      if (!eligibility.allowed) {
        clientSocket.send(JSON.stringify({ type: 'error', reason: eligibility.reason }));
        clientSocket.close(4002, 'Voice limit reached');
        return;
      }

      const capMinutes = eligibility.isPremium
        ? eligibility.minutesRemaining
        : Math.min(5, eligibility.minutesRemaining);
      const capMs = Math.max(1000, capMinutes * 60 * 1000);

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
              clientSocket.send(JSON.stringify({ type: 'audio', data: base64Audio }));
            }
          },
          onClose: (reason) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
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

      clientSocket.send(JSON.stringify({ type: 'ready', capSeconds: Math.floor(capMs / 1000) }));

      accountingTimer = setInterval(async () => {
        try {
          elapsedMs += ACCOUNTING_INTERVAL_MS;
          await recordVoiceMinutesUsed(dbClient, parentId, ACCOUNTING_INTERVAL_MS / 60000);
        } catch (err) {
          console.error('[Voice Socket] Error recording voice minutes:', err);
        }
      }, ACCOUNTING_INTERVAL_MS);

      hardCapTimer = setTimeout(() => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'cap_reached' }));
        }
        closeLiveSession(liveSession);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.close(4003, 'Session time limit reached');
        }
      }, capMs);

      clientSocket.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'audio_chunk') {
            sendAudioChunk(liveSession, msg.data);
          } else if (msg.type === 'text_prompt') {
            sendTextPrompt(liveSession, msg.data);
          }
        } catch (err) {
          console.error('[Voice Socket] Bad client message:', err);
        }
      });

      clientSocket.on('close', async () => {
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
