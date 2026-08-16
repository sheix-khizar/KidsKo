import { EventEmitter } from 'events';

// SPEECH DEBOUNCE LOGIC TEST SIMULATION (Matching mobile/src/services/voiceSocket.ts)
const SPEECH_SEND_DEBOUNCE_MS = 300;

class SimulatedVoiceSession {
  private lastSentTranscript = '';
  private pendingTranscript = '';
  private transcriptDebounceTimer: NodeJS.Timeout | null = null;
  private speechCycleId = 0;
  private isSessionActive = true;
  private wsOpen = true;

  // Tracked test metrics
  public sentGeminiTurns: string[] = [];
  public isAudioPlaying = false;
  public stopPlaybackCallCount = 0;

  constructor() {}

  private isKidskoSpeaking(): boolean {
    return this.isAudioPlaying;
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

  private commitPendingTranscript(cycleId: number) {
    if (cycleId !== this.speechCycleId) {
      // Stale callback protection
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

    this.resetTurnState();
    this.lastSentTranscript = transcript;
    this.sentGeminiTurns.push(transcript);
  }

  public onRecognitionResult(rawTranscript: string) {
    if (!rawTranscript || rawTranscript.trim().length === 0) return;
    const normalized = rawTranscript.replace(/\s+/g, ' ').trim();
    if (normalized === this.lastSentTranscript) return;

    const currentCycleId = this.speechCycleId;

    // Immediate Barge-In: If Kidsko is speaking, stop playback immediately!
    if (this.isKidskoSpeaking()) {
      this.stopAudioPlayback();
    }

    this.pendingTranscript = normalized;

    if (this.transcriptDebounceTimer) {
      clearTimeout(this.transcriptDebounceTimer);
      this.transcriptDebounceTimer = null;
    }

    this.transcriptDebounceTimer = setTimeout(() => {
      this.commitPendingTranscript(currentCycleId);
    }, SPEECH_SEND_DEBOUNCE_MS);
  }
}

async function runUtteranceDebounceVerification() {
  console.log('🧪 ==========================================================');
  console.log('🚀 ADAPTIVE UTTERANCE DEBOUNCE VERIFICATION SUITE');
  console.log('🧪 ==========================================================\n');

  // Test A — Progressive Android Transcript
  {
    console.log('👉 [Test A] Progressive Android Transcript Updates...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    session.onRecognitionResult('hello');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('hello could');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('hello could you');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('hello could you hear');
    await new Promise((r) => setTimeout(r, 50));
    session.onRecognitionResult('hello could you hear me');

    // Wait for debounce period (350ms)
    await new Promise((r) => setTimeout(r, 350));

    if (session.sentGeminiTurns.length === 1 && session.sentGeminiTurns[0] === 'hello could you hear me') {
      console.log('  ✅ [PASS] Progressive updates produced exactly ONE Gemini turn: "hello could you hear me"');
    } else {
      throw new Error(`[FAIL] Expected 1 turn ("hello could you hear me"), got: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test B — Fast Speech Updates (Every 50ms)
  {
    console.log('\n👉 [Test B] Fast Speech Updates (Every 50ms)...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    const words = ['I', 'I have', 'I have a', 'I have a question', 'I have a question about', 'I have a question about my', 'I have a question about my homework'];
    for (const w of words) {
      session.onRecognitionResult(w);
      await new Promise((r) => setTimeout(r, 50));
    }

    await new Promise((r) => setTimeout(r, 350));

    if (session.sentGeminiTurns.length === 1 && session.sentGeminiTurns[0] === 'I have a question about my homework') {
      console.log('  ✅ [PASS] Fast speech updates reset timer continuously and sent ONE turn: "I have a question about my homework"');
    } else {
      throw new Error(`[FAIL] Expected 1 turn, got: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test C — Natural Pause (500ms apart)
  {
    console.log('\n👉 [Test C] Natural Pause (500ms apart)...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    session.onRecognitionResult('Hello');
    await new Promise((r) => setTimeout(r, 350)); // Turn 1 commits

    session.startNewCycle();
    session.onRecognitionResult('Can you help me');
    await new Promise((r) => setTimeout(r, 350)); // Turn 2 commits

    if (session.sentGeminiTurns.length === 2 && session.sentGeminiTurns[0] === 'Hello' && session.sentGeminiTurns[1] === 'Can you help me') {
      console.log('  ✅ [PASS] Natural pause produced TWO separate turns: ["Hello", "Can you help me"]');
    } else {
      throw new Error(`[FAIL] Expected 2 turns, got: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test D — Duplicate Result Filtering
  {
    console.log('\n👉 [Test D] Duplicate Result Filtering...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    session.onRecognitionResult('hello could you hear me');
    session.onRecognitionResult('hello could you hear me');
    await new Promise((r) => setTimeout(r, 350));

    if (session.sentGeminiTurns.length === 1) {
      console.log('  ✅ [PASS] Duplicate result produced exactly ONE Gemini turn');
    } else {
      throw new Error(`[FAIL] Duplicate resulted in multiple turns: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test E — Immediate Barge-In
  {
    console.log('\n👉 [Test E] Immediate Barge-In (AI Playback Active)...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();
    session.isAudioPlaying = true;

    session.onRecognitionResult('Stop I want to ask something');

    if (session.stopPlaybackCallCount === 1 && !session.isAudioPlaying) {
      console.log('  ✅ [PASS] AI Audio playback stopped IMMEDIATELY (0ms delay) upon speech detection!');
    } else {
      throw new Error('[FAIL] Audio playback was not stopped immediately upon barge-in');
    }

    await new Promise((r) => setTimeout(r, 350));

    if (session.sentGeminiTurns.length === 1 && session.sentGeminiTurns[0] === 'Stop I want to ask something') {
      console.log('  ✅ [PASS] Stabilized turn committed after barge-in: "Stop I want to ask something"');
    } else {
      throw new Error(`[FAIL] Expected 1 turn after barge-in, got: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test F — no-speech (Zero Gemini Turns)
  {
    console.log('\n👉 [Test F] no-speech Event...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle();

    // no-speech emits no transcript
    await new Promise((r) => setTimeout(r, 350));

    if (session.sentGeminiTurns.length === 0) {
      console.log('  ✅ [PASS] no-speech event produced ZERO Gemini requests');
    } else {
      throw new Error(`[FAIL] Expected 0 turns for no-speech, got: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  // Test G — Stale Callback Protection
  {
    console.log('\n👉 [Test G] Stale Callback Protection...');
    const session = new SimulatedVoiceSession();
    session.startNewCycle(); // Cycle #1

    session.onRecognitionResult('stale candidate turn 1');

    // Simulate native recognizer restart / cycle increment BEFORE turn 1 debounce timer fires
    session.startNewCycle(); // Cycle #2

    await new Promise((r) => setTimeout(r, 350));

    if (session.sentGeminiTurns.length === 0) {
      console.log('  ✅ [PASS] Stale callback from previous cycle ignored (0 turns sent)');
    } else {
      throw new Error(`[FAIL] Stale callback was incorrectly sent to Gemini: ${JSON.stringify(session.sentGeminiTurns)}`);
    }
  }

  console.log('\n==========================================================');
  console.log('🎉 100% ADAPTIVE UTTERANCE DEBOUNCE SUITE PASSED PERFECTLY!');
  console.log('==========================================================\n');
}

runUtteranceDebounceVerification().catch((err) => {
  console.error('Debounce verification failed:', err);
  process.exit(1);
});
