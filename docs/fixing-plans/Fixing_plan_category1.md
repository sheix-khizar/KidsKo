# Kidsko.ai: Category 1 Fixing Plan, Live Voice & Video Calling

> Status: current
> Covers: **Issue #8** (voice goes silent on a real Android phone) and **Issue #1** (no "stop talking" button in the video call)
> Base: `dev` at `25add0e` (Oct 25, 2026). Branch: `fix/category-1-call`. Tag first: `pre-cat1`.
> Suggested repo path: `docs/plans/current/category-1-live-call-fixing-plan.md`

---

## 1. What the plan does, in one paragraph

The call sometimes plays no sound on a real Android phone. The code has four steps between "Gemini answers" and "the child hears it", and nobody knows yet which step fails. So this plan **finds the failing step first** (Phase 0 and 1), then **fixes only that step** (Phase 2), then adds the **stop-talking button** (Phase 3), then **proves it on real phones** (Phase 4). Guessing a fix first is what makes call bugs come back.

---

## 2. Permission to touch the call code (a deliberate, temporary exception)

Since v7 the call files were frozen because the call worked. It does not work on your phone, so the freeze is lifted for this category only.

| File | May change? | What exactly |
|---|---|---|
| `mobile/src/services/voiceSocket.ts` | **Yes** | Audio mode, playback, logging, recovery. This is where #8 most likely lives. |
| `mobile/src/screens/LiveVoiceScreen.tsx` | **Yes, small** | A stop button and a status chip, wired to the **existing** `interrupt()`. No change to the frame loop, camera or session setup. |
| `backend/src/lib/voiceSocketServer.ts` | **Only if Phase 0 proves the server is the failing step** | Nothing else. |
| `backend/src/lib/geminiLive.ts` | **No** | The voice prompt rewritten on Oct 25 (`9598603`) stays as is for now. Phase 4 decides whether to keep or revert it. |
| `mobile/app.json` | Only for a permission fix found in Phase 0 | |

Rules for the whole category:
1. **One change per commit**, message `fix(call-1.N): ...`. Revert with `git revert`.
2. **Test on the phone after every commit.** Not the emulator.
3. If a change makes the call worse, revert it and write down what you saw.
4. Do not combine call fixes with any visual, prompt or backend work.

---

## 3. How the call works today (checked in the code)

```
Child speaks
  -> Android speech recogniser (expo-speech-recognition, text only)
  -> client sends text_prompt to the server over WebSocket
  -> server forwards the text to Gemini Live
  -> Gemini returns audio chunks (PCM, 24 kHz)
  -> server sends chunks to the phone
  -> phone joins them into ~1.2 s WAV pieces (first piece ~0.3 s)
  -> each piece is a "data:audio/wav;base64,..." address given to an expo-audio player
  -> players are chained, the next one is created while the current one plays
```

Facts from the code that matter:
- The phone **stops** the speech recogniser while Kidsko speaks, and **restarts** it 300 ms after playback ends.
- Audio mode is set with `interruptionMode: 'doNotMix'`, `shouldRouteThroughEarpiece: false`, `playsInSilentMode: true`.
- Players have **no error handler**. The only status event used is `didJustFinish`. If a player fails to load or play, the code keeps going and nothing is shown or logged.
- The app uses **expo-audio**, not expo-av. Advice that mentions expo-av audio settings does not apply to this code.
- `VoiceSession.interrupt()` already exists. It stops playback, bumps the turn number and sends an `interrupt` message. The server drops buffered audio for that turn.
- The only button that calls `interrupt()` is the **owl avatar, and only when the camera is off**. When video is on, the screen shows the camera view and **there is no way to stop Kidsko talking**. That is exactly Issue #1.

---

## 4. What "silent" can mean: four places it can break

| Layer | What goes wrong | The log line that proves it (already in the code) |
|---|---|---|
| L1 Server | Gemini sent no audio, or the server did not forward it | Backend: `[Backend Outbound Aggregated Audio Chunk]` is missing, or `[Backend Outbound turn_complete Frame]` appears with no chunks before it |
| L2 Network | Chunks left the server but never reached the phone | Phone: no `[Mobile Audio] First chunk received` after `Finalized spoken turn -> Sending prompt` |
| L3 Player | Chunks arrived, a player was created, but it never started or failed silently | Phone shows `First chunk received` and `Playback started`, but nobody hears anything. There is no player error log today, so this layer is invisible until Phase 1 |
| L4 Output | The player is "playing" but the phone does not output sound: audio focus lost, stream muted, wrong route, volume | Same logs as L3. Needs `dumpsys audio` during the silence (Phase 0) |

Most likely suspects, in order (**these are hypotheses, not findings**):
1. **L4, audio focus fight.** The Android speech recogniser and the players both ask the system for audio focus, and `doNotMix` makes the player demand exclusive focus. If the recogniser is still releasing focus when the next player starts, the player can be silenced.
2. **L3, data-address WAV playback.** Some phone makers' players are fussy about `data:` addresses. Failures would be silent because there is no error handler.
3. **A regression from v7 or v8.** The call was verified only on an emulator. One concrete thing changed on the native side: in `v8(3.4)` the `expo-camera` plugin was removed from `app.json`, and that plugin could add audio-related permissions to the Android manifest. This needs to be compared, not assumed.
4. **L2, the network.** Wi-Fi to mobile data switching, or a background-throttled connection.
5. **Phone settings:** volume down, Do Not Disturb, a connected Bluetooth device, or a battery saver that mutes background apps.

---

## Phase 0: Reproduce and capture (half a day, no code)

**Goal:** know which layer fails, on which phone, and under which conditions.

### Step 0.1: Record the phone
Write down: make and model, Android version, build type (**development client or release build**; they behave differently), and app version.

### Step 0.2: Reproduction matrix
Run each row once, note "works / silent / partly" and when it went silent (first turn, after N turns, after toggling video):

| # | Condition | Result |
|---|---|---|
| 1 | Voice only, Wi-Fi | |
| 2 | Voice only, mobile data | |
| 3 | Video on from the start, Wi-Fi | |
| 4 | Voice first, then video turned on mid-call | |
| 5 | Video toggled off and on twice | |
| 6 | Phone speaker, volume at 70% | |
| 7 | Wired or Bluetooth headset | |
| 8 | App sent to background for 10 s, then back | |
| 9 | Chat voice-input mic used first, then a call | |
| 10 | Call started right after another call ended | |

### Step 0.3: Capture the logs while it is silent
Connect the phone with USB debugging and run:

```bash
# App logs (JavaScript side)
adb logcat -v time ReactNativeJS:V *:S > app-log.txt

# Audio system logs (Android side)
adb logcat -v time | grep -iE "AudioFocus|AudioTrack|AudioManager|SpeechRecognizer|ExoPlayer|MediaPlayer" > audio-log.txt

# While the call is silent, in a second terminal:
adb shell dumpsys audio > dumpsys-audio-silent.txt
```
In `dumpsys-audio-silent.txt` look at the **audio focus stack** (who holds focus), the **muted streams** line, and whether the media stream volume is zero. Also read the **server log** for the same call (the `[Backend Outbound ...]` lines).

### Step 0.4: Bisect the regression
Install an older build on the same phone and repeat row 1 and row 3:
- `pre-v7` (before the redesign)
- `v7-final`
- `pre-v8` (`47493ba`, before the v8 visual work, with `expo-camera` already removed)
- current `dev`

Also compare the **Android permissions** of an old APK and a new one: `aapt dump permissions app.apk` (or the merged manifest in the build output). Note any audio-related permission that disappeared.

- **DoD:** you can say "silent starts in layer ___ , on ___ phone, when ___ , and it (does / does not) happen on build ___".
- If the call is silent on `pre-v7` too, the bug is old and not caused by v7 or v8. That changes what to fix.

---

## Phase 1: Instrument (half a day, logging only)

**Goal:** make layers L3 and L4 visible. **No behaviour change.** One commit, removable.

In `voiceSocket.ts`, add logging (behind a single `DIAG_AUDIO` constant that is `true` in development builds only):
1. For every player: log **creation, load, playing, paused, error, and `didJustFinish`**, using the player status events and the segment number.
2. Log how long each player took from `play()` to the first "playing" status. A player that never reports playing within 1.5 s is the L3 signal.
3. Log the audio mode that was set (fields and values) every time `forceLoudspeakerAudio()` runs, and any error it throws.
4. Log the order of events around the turn boundary: speech recogniser `stop` call, recogniser `end` event, first player `play()`.
5. Log the WebSocket state and close code when the session ends.

Read the SDK 57 `expo-audio` docs (`mobile/AGENTS.md` rule) to confirm which status fields exist before writing this.

- **DoD:** a silent call now shows, in the log, exactly which segment failed and in what state.

---

## Phase 2: Fix the layer that failed (1 to 2 days)

Do only the fix that matches what Phases 0 and 1 showed. One fix per commit, retest on the phone each time, stop when the matrix is clean.

| Fix | Applies if | What to change |
|---|---|---|
| **2.1 Strict turn-taking for audio focus** | L4 and the focus stack shows the recogniser still holding focus when playback starts | Do not start the first player until the recogniser's `end` event has fired (with a short timeout so the call never waits forever). After playback finishes and all players are removed, wait before restarting the recogniser. This replaces today's fixed 50 ms and 300 ms timers. |
| **2.2 Interruption mode** | L4 and focus is being stolen or denied | Replace `doNotMix` with the mode the SDK 57 docs recommend for "speech app that plays replies" (likely `duckOthers`). Re-apply the audio mode right before the first player of every turn, not only at session start. Confirm with the docs which modes Android supports. |
| **2.3 File playback instead of `data:` addresses** | L3: players fail or never report playing on this phone | Write each WAV piece to the app cache folder and give the player a `file://` address. Delete files when the turn ends and on session end. Use the file API that SDK 57 recommends. |
| **2.4 Player self-recovery** | L3 on some turns only | If a player does not report playing within about 1.5 s, recreate it once for the same piece. If it fails twice, show the existing notice banner ("Having trouble with sound. Speak again.") and move on. A silent failure is the worst outcome. |
| **2.5 Manifest or permission fix** | Phase 0.4 found a permission that disappeared | Add it back explicitly in `app.json`, then rebuild the dev client. |
| **2.6 Connection recovery** | L1 or L2 and the WebSocket closed or stalled | Detect a closed socket mid-call and tell the child clearly. Reconnecting automatically is a larger change; only do it if the matrix shows frequent drops. Server-side keep-alive pings go here and need the server exception from section 2. |
| **2.7 Nothing to fix in code** | The phone had volume, Do Not Disturb or a headset problem | Add a one-line tip on the call landing ("Turn the volume up so Kidsko can be heard") and stop. |

**Do not** try several of these at once. If 2.1 fixes it, stop. A fix that "also seems harmless" is how a working call breaks.

- **DoD:** every row of the Phase 0 matrix that was silent now plays, on at least two different phones.

---

## Phase 3: Issue #1, the stop-talking button (half a day)

**Goal:** a child can always make Kidsko stop talking, in voice mode and in video mode.

What exists: `VoiceSession.interrupt()` (client) and the `interrupt` handler (server). What is missing: a control when the camera is on, and a clear control when it is off.

In `LiveVoiceScreen.tsx` (JSX and styles, plus one new `onPress` that calls the existing method):
1. **A stop pill** that appears whenever `voiceState === 'speaking'`, in **both** modes. In video mode it sits over the camera view near the bottom. Label: "✋ Stop". At least 44 pt tall, high contrast, with a clear accessibility label ("Stop Kidsko talking").
2. In video mode also show a **small state chip** ("Kidsko is talking", "Thinking", "Listening") so the child knows what is happening. Video mode shows no state today.
3. Keep tapping the owl avatar working in voice mode.
4. **Debounce** the button (ignore a second tap within about 400 ms) so a double tap does not interrupt the next turn.
5. Use the existing `PressScale` and theme tokens; no hardcoded colours.

Checks against the code:
- The server `interrupt` handler drops buffered audio and sets `isTurnInterrupted`, but **does not tell Gemini to stop generating**; Gemini keeps producing audio that the server discards until the next prompt. That is fine for the child but wastes some tokens. Leave it; do not change `geminiLive.ts`.
- After `interrupt()` the phone restarts the speech recogniser, so the child can talk right away. Test that it really does.

- **DoD:** in voice and video mode, tapping Stop while Kidsko is mid-sentence ends the audio within about 300 ms, the screen shows "Listening", and the next question is understood.

---

## Phase 4: Prove it (half a day)

On at least **two real Android phones** (include a budget one) and, if you have one, an iPhone:

| Test | Pass when |
|---|---|
| 5-minute call, video toggled twice | No silent turns, no stutter, no crash |
| 10 interrupt cycles (voice) and 10 (video) | Every one stops audio and the next turn works |
| Phone call or notification arrives mid-call | The call recovers or ends cleanly with a message |
| App to background for 30 s and back | Call state is correct, no zombie audio |
| Screen lock and unlock | Same as above |
| Wired or Bluetooth headset connected and removed mid-call | Audio follows the route, not silent |
| Chat voice input, then a call, then chat voice input again | Both still work |
| The new voice prompt (`9598603`) | Replies fit in about 15 s, no rambling, math answers are correct. If the call replies are too long or the timing is worse than before, **revert that commit** in a separate commit |

Record the logs and a short screen recording, and save the result in `docs/checklists/category-1-device-results.md` (date, phone, build type, evidence for every row).

- **DoD:** the full table passes on two phones, with evidence. Then merge to `dev`.

---

## 5. Timeline and risks

| Phase | Effort | Main risk | Mitigation |
|---|---|---|---|
| 0 Reproduce | 0.5 day | Cannot reproduce | Try the other phones and build types in the matrix; compare release and dev client |
| 1 Instrument | 0.5 day | Logging changes timing | Keep logs light; remove after the fix |
| 2 Fix | 1 to 2 days | A fix breaks working phones | One fix at a time; test on a second phone |
| 3 Stop button | 0.5 day | Double interrupt, stuck state | Debounce; test rapid taps |
| 4 Prove | 0.5 day | Only one phone available | Borrow a second Android phone |

**Total about 3 to 4 days**, mostly waiting on device tests.

## 6. Housekeeping while you are here
- The Category 4 doc currently lives in `docs/fixing-plans/Fixing_plan_category4.md`. The docs structure from `docs/README.md` expects lowercase names under `plans/`. Move it to `docs/plans/current/category-4-ai-quality-fixing-plan.md` and keep this file beside it.
- The v8 acceptance checklist says the wave bars and live dot move in the call. The call screen does not render them yet (Step 8.6). If you add them, do it **after** Phase 4 is green, in a separate commit, so a call bug is never confused with a visual change.
- Update `docs/checklists/v7-regression-checklist.md` Section 7.3 (budget-phone test) with the real result from Phase 4.

## 7. Definition of Done for Category 1
- Silent audio is reproduced, its layer is identified, and the fix is in a single, revertable commit.
- Matrix rows 1 to 10 pass on two real phones.
- The stop button works in voice and video mode, with debounce.
- The 5-minute call with video toggled twice passes.
- Evidence (logs, recording, results file) is committed.
- The decision on the new voice prompt is recorded.