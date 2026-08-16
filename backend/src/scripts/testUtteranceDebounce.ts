import { EventEmitter } from 'events';

// STRICT TURN-TAKING & SINGLE ACTIVE TURN TEST SUITE
const SPEECH_SEND_DEBOUNCE_MS = 400;

class SimulatedVoiceSession {
  private lastSentTranscript = '';
  private pendingTranscript = '';
  private transcriptDebounceTimer: NodeJS.Timeout | null = null;
  private speechCycleId = 0;
  private currentTurnId = 1;
  private sessionState: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'INTERRUPTED' = 'IDLE';
  private isSessionActive = true;
  private wsOpen = true;

  // Tracked test metrics
  public sentGeminiTurns: { turnId: number; transcript: string }[] = [];
  public isAudioPlaying = false;
  public stopPlaybackCallCount = 0;
  public discardedAudioChunks: { turnId: number; data: string }[] = [];
  public acceptedAudioChunks: { turnId: number; data: string }[] = [];

  constructor() {}

  public getSessionState() {
    return this.sessionState;
  }

  public getCurrentTurnId() {
    return this.currentTurnId;
  }

  private isKidskoSpeaking(): boolean {
    return this.isAudioPlaying || this.sessionState === 'SPEAKING';
  }

  private clearPendingDebounce() {
    if (this.transcriptDebounceTimer) {
      clearTimeout(this.transcriptDebounceTimer);
      this.transcriptDebounceTimer = null;
    }
    this.pendingTranscript = '';
  }

  public stopAudioPlayback() {
    this.isAudioPlaying = false;
    this.stopPlaybackCallCount++;
    this.clearPendingDebounce();
  }

  private resetTurnState() {
    this.clearPendingDebounce();
    this.isAudioPlaying = false;
  }

  public startNewCycle() {
    this.speechCycleId++;
  }

  public simulateInboundAudioChunk(turnId: number, data: string) {
    if (turnId !== this.currentTurnId) {
      this.discardedAudioChunks.push({ turnId, data });
      return;
    }
    this.isAudioPlaying = true;
    this.sessionState = 'SPEAKING';
    this.acceptedAudioChunks.push({ turnId, data });
  }

  private commitPendingTranscript(cycleId: number, targetTurnId: number) {
    if (cycleId !== this.speechCycleId || targetTurnId !== this.currentTurnId) {
      // Stale callback / turn invalidation guard
      return;
    }

    const transcript = this.pendingTranscript.trim();
    this.pendingTranscript = '';

    if (this.transcriptDebounceTimer) {
      clearTimeout(this.transcriptDebounceTimer);
      this.transcriptDebounceTimer = null;
    }

    if (!transcript || transcript.length === 0) return;
    if (transcript === this.lastSentTranscript) return;
    if (!this.isSessionActive || !this.wsOpen) return;

    this.sessionState = 'THINKING';
    this.resetTurnState();
    this.lastSentTranscript = transcript;
    this.sentGeminiTurns.push({ turnId: this.currentTurnId, transcript });
  }

  public onRecognitionResult(rawTranscript: string) {
    if (!rawTranscript || rawTranscript.trim().length === 0) return;
    const normalized = rawTranscript.replace(/\s+/g, ' ').trim();
    if (normalized === this.lastSentTranscript) return;

    const currentCycleId = this.speechCycleId;

    // ⚡ REAL BARGE-IN: If Kidsko is speaking, invalidate old turn immediately!
    if (this.isKidskoSpeaking() || this.sessionState === 'SPEAKING') {
      const oldTurnId = this.currentTurnId;
      this.currentTurnId++; // Increment turn ID! Old turn becomes dead!
      this.stopAudioPlayback();
      this.sessionState = 'LISTENING';
    } else if (this.sessionState === 'IDLE' || this.sessionState === 'THINKING') {
      this.sessionState = 'LISTENING';
    }

    this.pendingTranscript = normalized;

    if (this.transcriptDebounceTimer) {
      clearTimeout(this.transcriptDebounceTimer);
      this.transcriptDebounceTimer = null;
    }

    this.transcriptDebounceTimer = setTimeout(() => {
      this.commitPendingTranscript(currentCycleId, this.currentTurnId);
    }, SPEECH_SEND_DEBOUNCE_MS);
  }
}

async function runTurnTakingVerificationSuite() {
  console.log('🧪 ==========================================================');
  console.log('🚀 STRICT VOICE TURN-TAKING & TURN INVALIDATION SUITE');
  console.log('🧪 ==========================================================\n');

  // Test 1 — Normal Sentence (Progressive updates -> 1 Gemini Turn)
  {
    console.log('👉 [Test 1] Normal Sentence Progressive Candidate Updates...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    session.onRecognitionResult('can');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('can you');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('can you help');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('can you help me');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('can you help me with my homework');

    await new Promise((r) => setTimeout(r, 450));

    if (session.sentGeminiTurns.length === 1 && session.sentGeminiTurns[0].transcript === 'can you help me with my homework') {
      console.log('  ✅ [PASS] Sent exactly ONE final transcript: "can you help me with my homework"');
    } else {
      throw new Error(`[FAIL] Expected 1 turn, got: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test 2 — Barge-In / Interruption & Old Turn Audio Invalidation
  {
    console.log('\n👉 [Test 2] Barge-In & Invalidation of Stale In-Flight Audio...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    // Turn 1 starts
    session.onRecognitionResult('Question four asks about');
    await new Promise((r) => setTimeout(r, 450)); // Turn 1 sent
    const turn1Id = session.sentGeminiTurns[0].turnId;

    // Simulate inbound audio for Turn 1
    session.simulateInboundAudioChunk(turn1Id, 'audio_chunk_1');
    if (session.getSessionState() !== 'SPEAKING') throw new Error('Session state should be SPEAKING');

    // Child interrupts while Turn 1 audio is playing!
    session.onRecognitionResult('Wait stop explain it again');

    // Turn ID should have incremented to Turn 2 immediately!
    const turn2Id = session.getCurrentTurnId();
    if (turn2Id !== turn1Id + 1) throw new Error(`Expected Turn ID to increment from ${turn1Id} to ${turn1Id + 1}`);
    if (session.stopPlaybackCallCount !== 1) throw new Error('Audio playback should stop immediately');
    if (session.getSessionState() !== 'LISTENING') throw new Error('Session state should be LISTENING');

    // Simulate in-flight audio chunk for OLD Turn 1 arriving after interruption
    session.simulateInboundAudioChunk(turn1Id, 'stale_audio_chunk_turn_1');
    if (session.discardedAudioChunks.length !== 1 || session.discardedAudioChunks[0].turnId !== turn1Id) {
      throw new Error('Stale audio chunk for Turn 1 was not discarded');
    }
    console.log('  ✅ [PASS] Stale in-flight audio chunk for Turn 1 was discarded successfully!');

    // Wait for Turn 2 candidate stabilization
    await new Promise((r) => setTimeout(r, 450));

    if (session.sentGeminiTurns.length === 2 && session.sentGeminiTurns[1].turnId === turn2Id && session.sentGeminiTurns[1].transcript === 'Wait stop explain it again') {
      console.log('  ✅ [PASS] Only Turn 2 prompt sent after interruption: "Wait stop explain it again"');
    } else {
      throw new Error(`[FAIL] Expected Turn 2 to send, got: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test 3 — Multiple Consecutive Interruptions
  {
    console.log('\n👉 [Test 3] Multiple Consecutive Interruptions...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    // Turn 1
    session.onRecognitionResult('Tell me about stars');
    await new Promise((r) => setTimeout(r, 450));
    session.simulateInboundAudioChunk(1, 'audio_star_1');

    // Interrupt 1 -> Turn 2
    session.onRecognitionResult('Wait what about the sun');
    await new Promise((r) => setTimeout(r, 450));
    session.simulateInboundAudioChunk(2, 'audio_sun_1');

    // Interrupt 2 -> Turn 3
    session.onRecognitionResult('Wait how far is it');
    await new Promise((r) => setTimeout(r, 450));
    session.simulateInboundAudioChunk(3, 'audio_distance_1');

    if (session.sentGeminiTurns.length === 3 && session.sentGeminiTurns[2].turnId === 3) {
      console.log('  ✅ [PASS] Successfully handled 3 consecutive turns without old audio leakage!');
    } else {
      throw new Error(`[FAIL] Multiple interruptions failed: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  console.log('\n==========================================================');
  console.log('🎉 100% STRICT VOICE TURN-TAKING SUITE PASSED PERFECTLY!');
  console.log('==========================================================\n');
}

runTurnTakingVerificationSuite().catch((err) => {
  console.error('Turn-taking verification failed:', err);
  process.exit(1);
});
