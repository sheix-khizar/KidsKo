# Kidsko.ai — Master Plan (v6.0)
**The final tier structure, and how to implement it safely on top of the current stable voice baseline.**

**Who this document is for:** Every section is written so a PM/founder can read it for the business picture, a CTO can read it for architecture and risk, a developer can read it for exact file/constant changes, and an AI coding agent can execute the task blocks directly. Role-specific detail is called out where it matters; everything else is written plainly enough for all four to follow the same document.

Supersedes v5.0. v4.1's architecture, legal/COPPA sections, and anything not explicitly addressed below carry over unchanged.

---

## 1. One-Paragraph Summary (read this first, whoever you are)

Voice is stable again after a full revert to the September 12 codebase — but that revert also erased v5's product changes (the tier numbers, the duplicate Scan button removal, paywall copy). Separately, we've now finalized the actual tier structure with real cost and app-store-fee math behind it (Section 3). This plan re-applies the product changes on top of the current stable baseline, using the new final numbers — and, critically, does **not** touch the voice pipeline internals that were the source of a week of regressions. Everything here is config, UI copy, and one piece of new tracking logic (converting message/upload limits from daily to weekly). Nothing here should require reopening `voiceSocket.ts` or the camera capture loop.

---

## 2. Current Ground Truth (confirm before starting — PM/CTO/Dev should all read this)

Directly confirmed from the `dev` branch as of this writing:

| Area | Actual current state |
|---|---|
| Voice pipeline | **Stable**, reverted to the Sept 12 baseline. Do not modify — see Section 6. |
| `FREE_WEEKLY_VOICE_MINUTES` | `5` (v5's change to `10` was lost in the revert) |
| `PREMIUM_WEEKLY_VOICE_MINUTES` | `25` (needs to become `100` per the new final structure) |
| `FREE_WEEKLY_LIVE_SNAPSHOTS` / `PREMIUM_WEEKLY_LIVE_SNAPSHOTS` | Still exist as **separate discrete counters** (3 / 20) — the unified-pool change was also lost in the revert |
| `FREE_DAILY_MESSAGE_LIMIT` / `FREE_DAILY_SCAN_LIMIT` | `30` / `5` — tracked **daily**, not weekly. No confirmed premium-specific cap exists yet (premium appears to bypass the daily limit entirely per the original SRS design) |
| `HomeScreen.tsx` | The `📸 Scan` button is back (duplicate entry point alongside `🎙️ Call`) |
| `PaywallScreen.tsx` | Copy still reflects the old 25-min/20-snapshot framing |
| `realtimeInput.video` fix (deprecated `media_chunks`) | **Correction from Phase A's audit:** the *fix* to the field name survived, but the continuous live-video streaming loop that used to call it did not — it was removed in the revert along with the camera-loop instability it caused. There is currently **no live video feature in Call at all**, only a discrete "take a photo / choose from gallery" modal that sends one still image. See new Phase B2 below. |

**Do not assume any of the above without re-confirming at the start of implementation** — re-run a quick grep/read pass on each file before editing, exactly as Task 1 below specifies. Code drifts; this table is a snapshot, not a guarantee.

---

## 3. The Final Tier Structure (business decision — already made, documented here for implementation)

| | **Free** | **Premium** |
|---|---|---|
| Price | $0 | $19.99/month or $199/year |
| Voice & Video minutes/week (unified pool) | 10 | 100 |
| Text messages/week | 30 | 200 |
| Homework photo uploads/week (async, in text chat) | 3 | 15 |

### 3a. Feature Boundary: Call vs. Chat (clarified — confirmed against actual code)

This needs to be explicit, because the current `LiveVoiceScreen.tsx` (the `Call` screen) still has more than just voice and live video in it — confirmed directly in code: a `snapshotsRemaining` counter with "photo helps left this week" text, and a full "🖼️ Choose from Gallery" button, both sitting inside the call UI. That's a leftover from when Call doubled as a homework-scan tool. Folding the *limit* into the unified pool (Phase B, as originally written) is not enough on its own — it would leave that UI in place, still confusing Call with Chat's job.

**The intended boundary:**

```
                    KIDSKO
                       │
             ┌─────────┴─────────┐
             │                   │
           CHAT                CALL
             │                   │
       ┌─────┴─────┐       ┌─────┴─────┐
       │           │       │           │
     Text       Homework  Voice      Live Video
    messages      photo   (continuous feed)
       │           │       │           │
     30/200       3/15    └─────┬─────┘
                                │
                         Unified 10/100
                    Voice & Video minutes/week
```

**Rule:** `Call` supports exactly two live modes — Voice and Live Video (the continuous camera feed already streamed via `realtimeInput.video`, which is a genuine part of a live conversation). `Call` does **not** support discrete homework-photo capture or gallery-attach — that is Chat's job, and Chat's alone. A frame from the live video feed during a call is not a "homework upload"; it's part of the unified Voice & Video minute pool, same as the audio.

**Terminology fix:** use "**Voice & Video minutes/week**" in all UI copy and documentation, not "AI minutes/week." A parent reading "10 AI minutes" could reasonably assume that caps *all* AI usage, including text chat — which isn't true, since messages and uploads are separate counters. This applies everywhere "AI minutes" appears below and in the app itself (Phase E).

**Cost basis (for reference, already validated):**
- Voice: ~$0.0225/min (Gemini Live audio input+output)
- Voice+video: ~$0.0275/min (video adds ~22%, not the large multiple originally assumed — Gemini 3-series tokenizes video far more cheaply than older models)
- Free tier: ~$1.00–1.60/active user/month
- Premium: ~20% worst-case margin on monthly, ~4% worst-case on annual (both after 15% app-store commission) — **accepted deliberately**, monitor post-launch, revisit annual price if real usage trends toward worst-case (Section 8)

**Important structural note for developers:** messages and uploads move from **daily** tracking to **weekly** tracking, and premium gets an **explicit weekly cap** for the first time (previously implied unlimited/soft-capped). This is new logic, not just a constant change — see Task 3.

---

## 4. What Changes vs. What Absolutely Does Not

| Changes (this plan) | Does NOT change (leave alone) |
|---|---|
| Tier constants (voice minutes, message/upload caps) | `voiceSocket.ts` internals |
| Daily → weekly tracking for messages/uploads | Camera capture loop mechanics |
| Unify snapshot limit into the voice+video pool | Audio playback/buffer/watchdog logic |
| Remove duplicate Scan button from Home screen | Speech recognition (`SpeechRecognizer`) integration |
| Paywall copy | Anything in `geminiLive.ts`'s realtime audio/video session handling beyond what's explicitly listed here |
| Add explicit premium weekly message/upload cap | The Option B (native audio streaming) migration — separate, later effort, not part of this plan |

**If at any point implementing this plan seems to require touching `voiceSocket.ts`, `LiveVoiceScreen.tsx`'s camera loop, or `geminiLive.ts`'s audio handling — stop and flag it.** That's out of scope for v6 and is exactly the trap that caused last week's regression cycle.

---

## 5. Implementation Phases

Each phase below has a plain-language summary, then an agent-executable task block. Run phases in order. Do not start a phase until the previous one's Definition of Done is met.

---

### Phase A — Confirm current state (do not skip, even though Section 2 looks confident)

**Plain language:** Before changing anything, verify the ground-truth table above is still accurate. Code may have moved since this was written.

**Task for agent:**
> Open `backend/src/lib/voiceLimits.ts`, `backend/src/lib/usageLimits.ts`, `mobile/src/screens/HomeScreen.tsx`, and `mobile/src/screens/PaywallScreen.tsx`. For each, report the current actual values/state for: `FREE_WEEKLY_VOICE_MINUTES`, `PREMIUM_WEEKLY_VOICE_MINUTES`, `FREE_WEEKLY_LIVE_SNAPSHOTS`, `PREMIUM_WEEKLY_LIVE_SNAPSHOTS`, `FREE_DAILY_MESSAGE_LIMIT`, `FREE_DAILY_SCAN_LIMIT`, whether any premium-specific message/scan cap exists anywhere in the codebase, whether the `📸 Scan` button is present on `HomeScreen.tsx`, and the current paywall copy. Do not change anything — just report, so we can confirm this plan's assumptions before editing.

**Definition of Done:** Written confirmation matching (or correcting) Section 2's table.

---

### Phase B — Update voice+video pool constants (low risk — pure backend config)

**Plain language:** Change the free and premium weekly minute allowances to the final numbers, and remove the separate snapshot-limit logic on the backend. UI cleanup (the gallery button, the counter) is handled separately in Phase D, so this phase touches only limit constants and server-side checks — nothing visual.

**Task for agent:**
> In `backend/src/lib/voiceLimits.ts`:
> 1. Set `FREE_WEEKLY_VOICE_MINUTES = 10`.
> 2. Set `PREMIUM_WEEKLY_VOICE_MINUTES = 100`.
> 3. Remove `FREE_WEEKLY_LIVE_SNAPSHOTS` and `PREMIUM_WEEKLY_LIVE_SNAPSHOTS`, and remove `checkSnapshotEligibility`/`recordSnapshotUsed` entirely — not repurpose, remove. Per Section 3a, `Call` no longer has a discrete "homework snapshot" feature at all; the continuous live video feed is simply part of the same Voice & Video minute pool as audio, with no separate capture-and-analyze step.
> 4. Do not touch anything related to `daily_message_count` or `daily_scan_count` in this file — that's Phase C.
> 5. Do not touch any UI/screen files in this phase, even though removing the backend functions above will leave now-dead UI code referencing them in `LiveVoiceScreen.tsx` — that cleanup is Phase D's job specifically, so the two changes stay easy to review separately. It's fine for the app to be in a transiently inconsistent state between Phase B and Phase D within the same work session.
>
> This only affects limit-checking logic — do not touch `voiceSocketServer.ts`'s session/turn management, audio handling, or any code in `LiveVoiceScreen.tsx` at all in this phase.

**Definition of Done:** A free-tier test account can use up to 10 combined minutes of voice+video per week before being blocked with one consistent message. A premium test account gets 100. (The Call screen's UI cleanup is verified separately in Phase D — this phase's DoD is backend-only.)

---

### Phase B2 — Rebuild Live Video (real engineering — the one deliberate exception to Section 6's guardrail)

**Plain language:** The business decision is final: this release ships as "Call → Voice + Live Video," not voice-only. But Phase A's audit confirmed live video doesn't currently exist — it was lost in the revert along with the instability it caused. This phase rebuilds it, deliberately differently from before, because we now have evidence the old approach (`takePictureAsync` called repeatedly in a loop) was never going to be reliable — it's a long-documented source of hangs and multi-second stalls across Expo's camera library, not something specific to this codebase. Repeating the same pattern more carefully would likely reproduce the same risk.

**This is the one place in v6 that's allowed to touch camera code that Section 6 otherwise protects.** Everywhere else in this document, that guardrail still holds.

**Recommended technical direction:** Do not rebuild live video as repeated `takePictureAsync` calls, even paced or wrapped more carefully than before. Instead, use a proper continuous-frame-access approach — `react-native-vision-camera`'s frame processors are the standard solution for this in the React Native ecosystem, giving low-latency access to a live frame stream rather than repeatedly triggering a discrete, slow, capture-and-encode operation. **Trade-off to accept going in:** this requires a custom EAS development build (it's not available in Expo Go), which is a real setup cost, but it's a one-time cost — you're already using EAS Build per your existing store-submission plan, so this isn't a new pipeline, just an additional native dependency in it.

**Entry gate:** Phase B complete (backend voice/video pool constants in place). Does not depend on Phase C, D, or E.

| Ticket | Action | Definition of Done |
|---|---|---|
| B2.1 | Confirm `react-native-vision-camera` compatibility with Expo SDK 57 (managed + config plugin) and current React Native version; set up a custom EAS dev build with it installed | A test build runs on a real device with the library's example frame processor working, before any Kidsko-specific code is written |
| B2.2 | Implement a frame processor that samples frames at a low, fixed rate (start conservative — roughly 1 frame every 2–3 seconds, matching the previous loop's cadence, not higher) and sends each as a compressed JPEG over the existing voice WebSocket to the backend | Frames are received and logged by the backend at the expected rate on a real device, with no dropped connection |
| B2.3 | Backend: reconnect the frame payload to `realtimeInput.video` (the field-name fix from the original crash bug is still correct and reusable) | A live test session shows Gemini's spoken response referencing content visible in the camera feed, not just "no crash" — same verification bar as the original media_chunks fix required |
| B2.4 | Explicit resource/lifecycle safety: ensure the frame processor is fully torn down when a call ends, when the app backgrounds, and when the user manually toggles video off mid-call — this was never cleanly handled in the old implementation and is a likely source of the original freeze even independent of `takePictureAsync`'s own flakiness | Toggling video on/off repeatedly within one call, and backgrounding the app mid-video-call, are both tested explicitly and produce no hang, no orphaned camera session, no stuck UI |
| B2.5 | Full device matrix regression pass (reuse the matrix from the earlier voice-hardening plan) with live video active for the entire duration, not just spot-checked | Pass/fail table per device; specifically include at least one lower-spec/budget Android device, since that's where the original freeze reproduced most reliably |

**Exit KPI:** ✅ A live video call runs for 5+ minutes on a real mid-range/budget Android device with video continuously active, survives at least one interruption and one video on/off toggle, and Gemini's responses demonstrably reference live camera content — with zero hangs, confirmed across the device matrix, not just your primary test phone.

**Hard rule:** Phase D and Phase E (UI cleanup and paywall copy) must not reference "Live Video" as an active feature, and Phase F's verification must not claim video works, until this phase's Exit KPI is met. If B2 is still in progress, Phase D/E can proceed for everything except video-specific copy — but do not ship "Voice + Live Video" language anywhere a parent sees it until B2 is done and proven.

---



**Plain language:** Right now, message and photo-upload limits reset daily and premium users aren't capped at all. The new structure resets weekly and gives premium an explicit (generous) ceiling instead of no ceiling.

**Task for agent:**
> In `backend/src/lib/usageLimits.ts`:
> 1. Convert message and upload/scan limit tracking from daily to weekly — mirror the existing weekly-reset pattern already used in `voiceLimits.ts` for voice minutes (same `last_weekly_reset_at` style approach) rather than inventing a new reset mechanism.
> 2. Set the new weekly values: free tier 30 messages/week, 3 uploads/week; premium tier 200 messages/week, 15 uploads/week.
> 3. Confirm whether premium currently has *any* explicit cap enforcement path, or whether it silently bypasses all checks (per the original SRS: "Premium users bypass daily limits, soft server-side cap still applies to prevent abuse"). Report what you find. Add explicit premium cap enforcement if none exists — premium should now hit a real (generous) limit at 200 messages/15 uploads per week, not be unlimited.
> 4. Update the corresponding mobile-side usage display (wherever the "X messages remaining" / "X uploads remaining" UI currently reads from daily counts) to reflect weekly counts instead.
>
> This does not touch voice/video logic at all — confirm your changes are isolated to text-message and homework-upload limit checking only.

**Definition of Done:** A free account can send 30 messages and upload 3 homework photos per week before being blocked; a premium account can do 200/15. Both reset weekly, confirmed via a manual reset-date check, not just code review.

---

### Phase D — Enforce the Call/Chat feature boundary (UI only — this is where all screen cleanup happens)

**Plain language:** Two cleanups from Section 3a's rule, both handled here and only here, now that Phase B is backend-only. First, the Home screen has a redundant `📸 Scan` button duplicating what Chat already does. Second — the part the original v6 draft left ambiguous, and which Phase A's audit clarified further — the Call screen currently has discrete homework-style capture UI (a "take photo / choose from gallery" modal) standing in for what should be live video. Once Phase B2 lands, this modal's discrete-capture elements get removed and replaced by B2's continuous video UI; this phase handles the Home screen cleanup and the parts of Call cleanup that don't depend on B2.

**Depends on:** Phase B for the Home-screen/backend-constant parts. **Depends on Phase B2 specifically** for anything that assumes Call already has working live video — do not mark this phase's video-related items done until B2's Exit KPI is met.

**Task for agent:**
> 1. In `mobile/src/screens/HomeScreen.tsx`, remove the standalone `📸 Scan` button (the `onScanStudent` call) from each student row. Keep `🎙️ Call`, `Chat`, `Transcript`. This part does not depend on B2 and can be done anytime after Phase B.
> 2. In `mobile/src/screens/LiveVoiceScreen.tsx`, remove the discrete-capture UI (`snapshotsRemaining` state, "photo helps left this week" text, `isSendingSnapshot` state, the take-photo/"🖼️ Choose from Gallery" modal) **only once Phase B2's live-video replacement is in place and tested** — removing this before B2 is done would leave Call with no visual feature at all. Sequence: B2 lands and passes its Exit KPI first, then this discrete-capture UI is removed as part of the same change that wires in B2's new live-video UI, so Call is never left in a broken in-between state.
> 3. Re-confirm (do not assume from prior notes) that `mobile/src/screens/ChatScreen.tsx` still independently calls `analyzeHomework` for its own photo-attach flow during text chat — that flow must keep working, since it's Chat's job specifically, per Section 3a. Do not delete `HomeworkScreen.tsx` or the backend `homework.ts` route — only remove the Home screen button that opens `HomeworkScreen.tsx` directly, and the Call-screen elements from step 2.
>
> End state to verify: Home → `Call`, `Chat`, `Transcript` only. Call → Voice and Live Video only, nothing homework-related. Chat → text messages and homework photo attach, and only Chat.

**Definition of Done:** Home screen shows only `🎙️ Call`, `Chat`, `Transcript` per student. The Call screen's UI contains no gallery button, no snapshot/photo-helps counter, and no homework-related affordance anywhere — and live video (from B2) works in its place, confirmed by testing a video call end to end, not just reading the diff. Text-chat photo attachment via `ChatScreen.tsx` still works, confirmed by testing it directly.

---

### Phase E — Update paywall and in-app copy

**Plain language:** Make sure every number a parent or child sees in the app matches the new structure — no leftover "25 minutes" or "3 photo helps" text anywhere. **Video-specific copy is gated on B2, per Phase B2's hard rule** — don't advertise a feature that isn't shipped and proven yet.

**Task for agent:**
> In `mobile/src/screens/PaywallScreen.tsx`, update all copy to reflect: Free — 10 Voice & Video minutes/week, 30 messages/week, 3 uploads/week. Premium — $19.99/month or $199/year, 100 Voice & Video minutes/week, 200 messages/week, 15 uploads/week. Use "Voice & Video minutes," not "AI minutes," per Section 3a's terminology rule. **Do not use "Voice & Video" language until Phase B2's Exit KPI is confirmed met — check with the team before this phase ships if B2's status is unclear.**
>
> Search the full mobile codebase for any other UI strings referencing the old numbers (5 min, 25 min, 3 snapshots, 20 snapshots, 30 messages/day, 5 scans/day) — check `LiveVoiceScreen.tsx`'s remaining-time/remaining-snapshot displays specifically — and update them all to match.

**Definition of Done:** No UI text anywhere in the app references any of the old numbers. A full read-through of the paywall and in-call remaining-usage displays matches Section 3's table exactly, and "Voice & Video" language is confirmed accurate against B2's actual shipped state, not aspirational.

---


### Phase F — End-to-end verification (do not skip)

**Plain language:** Prove the whole thing works together, on a real device, before calling this done.

**Task for agent + manual QA:**
> 1. Fresh free-tier test account: use voice+video until the 10-minute weekly cap blocks further use; confirm the block message is accurate and the paywall shows correctly.
> 2. Same account: send 30 messages, confirm the 31st is blocked; upload 3 homework photos in chat, confirm the 4th is blocked.
> 3. Upgrade to a premium test account (sandbox purchase): confirm 100 minutes, 200 messages, 15 uploads are all available and enforced at those new ceilings, not silently unlimited.
> 4. Confirm voice call quality/stability is unaffected — run the same repro conditions that previously triggered the freeze (multiple turns, at least one interruption, camera on) and confirm no regression, since even though this plan doesn't touch voice code, a full regression pass is still required before shipping any release.

**Definition of Done:** All four checks pass, recorded (screen recording or detailed log capture) for the record.

---

## 6. Explicit Guardrail — Read This If You're an AI Agent

**Do not modify, refactor, or "improve" any of the following as part of this plan, even if you notice something that looks fixable while working nearby:**
- `mobile/src/services/voiceSocket.ts`
- Anything related to audio streaming, playback, buffering, or watchdog logic anywhere in the mobile or backend voice pipeline
- `backend/src/lib/geminiLive.ts`'s audio session handling (beyond what Task B.3 explicitly asks you to touch in the snapshot-limit backend logic, which is limit-checking code, not the streaming/session code itself)
- `backend/src/lib/voiceSocketServer.ts`'s turn/session management

**The one explicit exception is Phase B2 (Live Video rebuild).** Per Phase A's audit, live video does not currently exist in the codebase — it was removed in the revert, so there is no existing "mechanics to leave alone" for it the way there is for audio. Phase B2 is the sole authorized place to write new camera/video code, and it has its own entry gate, ticket list, and Exit KPI specifically because it's the one piece of this plan that carries real technical risk — treat it with the same care as the separate architecture migration plan, not as a quick add-on to a pricing release. Everything else in this guardrail list still applies at full strength, including within Phase B2's own work: it should not touch `voiceSocket.ts`, audio handling, or `voiceSocketServer.ts`'s turn management even while building new video capture.

If you find something that looks like a bug in the audio-pipeline files while working on this plan, **stop and report it — do not fix it inline.** Those files were the source of a week of regressions caused by well-intentioned incremental fixes. Any change to them needs to go through the separate architecture migration plan (`kidsko-architecture-migration-option-b.md`), with its own testing gates — not be bundled into a tier/pricing update.


---


## 7. Risk Register

| Risk | Mitigation |
|---|---|
| Agent scope-creeps into voice internals while implementing tier changes | Section 6's explicit guardrail; PM/CTO should spot-check the diff before merging to confirm no voice files were touched |
| Weekly reset logic for messages/uploads introduces a new bug (new code, not just constants) | Phase C's Definition of Done requires a real reset-date verification, not just a code read |
| Real premium usage trends toward the worst-case annual-margin scenario | Accepted deliberately per the founder's decision — Section 8 defines the monitoring trigger |
| Removing the Scan button breaks something `ChatScreen.tsx` quietly depended on | Phase D explicitly requires re-confirming the dependency before removing anything |

---

## 8. Post-Launch Monitoring Plan (ties to the "monitor, then adjust" decision)

Since the annual plan's worst-case margin was accepted deliberately rather than fixed upfront, define what "not good" looks like now, before launch, so the decision to raise the annual price later is based on a clear trigger, not a gut feeling:

- **Data source:** `usageEvents.ts`'s cost-per-feature tracking (already confirmed wired and functional).
- **Trigger to review annual pricing:** if the trailing-4-week average premium user cost (voice+video+messages+uploads combined) exceeds roughly 65–70% of the effective monthly annual-plan revenue ($16.58) for two consecutive months, that's the signal the worst-case scenario is becoming the typical case, not the exception — revisit pricing at that point per the three options already discussed (raise annual price, trim the weekly allowance, or hold and monitor further with a defined re-check date).
- **Who owns this check:** PM/founder, monthly, using the existing usage dashboard — not something that needs new engineering work to observe.

---

## Bottom Line

This plan is deliberately narrow: it implements the finalized tier structure on top of a voice pipeline that's finally stable, and it says explicitly, in writing, not to touch that pipeline while doing it. Every phase is config, UI copy, or one piece of contained new logic (the daily→weekly conversion), each with its own verification step. The riskier, more interesting work — the Option B architecture migration — stays exactly where it was left: a separate, later, deliberately-gated effort, not something to fold into this release.