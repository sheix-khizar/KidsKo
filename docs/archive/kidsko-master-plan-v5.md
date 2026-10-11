# Kidsko.ai — Master Plan (v5.0)
**Updated for: consolidating duplicate homework-image paths into one live-video flow, diagnosing the "UI hangs / no buttons work but backend timer keeps running" bug, and a new unified free/paid tier (10 min/week free trial, covering both voice and video, then paid).**

Supersedes v4.1 for anything below. Architecture, legal/COPPA sections, and anything not explicitly changed here carry over unchanged from v4.1.

**Methodology note:** Everything in Section 0 was confirmed by directly reading the actual code on `github.com/sheix-khizar/KidsKo` (`dev` branch) on the date this plan was written — not assumed from prior planning docs. Where this plan says a file "currently does X," that's from the real file, not a guess. Anything I could not verify directly is marked **[UNVERIFIED — confirm before starting]**.

---

## 0. Ground Truth — What's Actually in the Repo Right Now

### 0.1 Screens (confirmed via `mobile/src/screens/`)
```
ChatScreen.tsx        HomeScreen.tsx         HomeworkScreen.tsx
LiveVoiceScreen.tsx   LoginScreen.tsx        PaywallScreen.tsx
RegisterScreen.tsx    TranscriptScreen.tsx
```
Settings, Notifications, Dark Mode, and Language screens from the original 11-screen prototype **still do not exist** — this was already flagged as not-started in v4.1's Phase 6 status and remains true.

### 0.2 The duplication problem — confirmed at the code level
This is the root of the "too much confusion" you flagged, and it's real, not a misperception. There are currently **three separate paths** for a child to get a homework image in front of the AI:

1. **The standalone "📸 Scan" flow** — `HomeScreen.tsx` has a dedicated `onScanStudent` button per student that routes to `HomeworkScreen.tsx` — a separate, older, static image-upload screen (this is the original Phase 3 feature from `master-plan-v2.md`).
2. **"Choose from Gallery instead"** — inside `LiveVoiceScreen.tsx` itself, alongside the live camera, there's a `handlePickGallery` link that lets a user pick a photo from their gallery *during a voice call* — functionally overlapping with #1.
3. **Live camera + instant snapshot** — also inside `LiveVoiceScreen.tsx`: an `handleToggleCamera` → live viewfinder → `handleInstantSnapshot` button, which is the new live-video feature you added.

**On the Home screen itself**, each student row shows four separate buttons: `🎙️ Call`, `📸 Scan`, `Chat`, `Transcript` — so a parent/child sees "Call" and "Scan" as two different things to tap, even though "Call" now internally contains its own scan-equivalent features (gallery picker + live camera + instant snapshot). This is the confusion, concretely located.

### 0.3 The "UI hangs, no buttons work, backend timer runs" bug — root cause candidate found
In `LiveVoiceScreen.tsx`, the continuous camera-vision loop works like this:
```js
// Runs every 2.5s while camera is active AND voiceState === 'listening'
const capturePromise = cameraRef.current.takePictureAsync({ ...options });
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Camera capture timeout')), 2500)
);
// raced against each other
```
The code comment directly above this says: *"Guard with 2.5s timeout so Android Camera2 driver NEVER permanently freezes the JS thread."* — meaning this was **already a known risk the previous work tried to defend against**.

**Why this guard likely doesn't fully work:** racing a JS-level `Promise.race` against a native camera call only makes the *JavaScript side* stop waiting after 2.5s — it does **not** cancel the underlying native `takePictureAsync` call or free up Android's Camera2 pipeline/JS bridge if that native call is genuinely stuck. On some real devices, a slow or stuck native camera capture can block the bridge/JS thread regardless of a JS-side timeout racing against it. This would explain your exact symptom:
- **Backend timer keeps running correctly** — the backend has no dependency on the mobile JS thread; the WebSocket session cap countdown (`voiceLimits.ts`) runs entirely server-side, so it's completely unaffected by a frozen mobile UI.
- **No buttons work, nothing talking** — if the JS thread (or the native module bridge specifically) is blocked by a stuck camera call, React Native's event loop can't process touch events or update UI state, even though audio *chunks* might theoretically still be arriving over the WebSocket in the background — but nothing can render or respond, so it looks completely dead from the user's side.

**This is a strong hypothesis, not yet a confirmed root cause** — it fits the symptom precisely, but needs to be verified against real device logs (Section 5, Ticket 1) before treating it as solved. [UNVERIFIED — confirm before starting fix]

### 0.4 Current tier limits (confirmed in `backend/src/lib/voiceLimits.ts` and `usageLimits.ts`)
```ts
// voiceLimits.ts
FREE_WEEKLY_VOICE_MINUTES = 5
PREMIUM_WEEKLY_VOICE_MINUTES = 25
FREE_WEEKLY_LIVE_SNAPSHOTS = 3
PREMIUM_WEEKLY_LIVE_SNAPSHOTS = 20

// usageLimits.ts
FREE_DAILY_MESSAGE_LIMIT = 30
FREE_DAILY_SCAN_LIMIT = 5
```
Usage is **family-pooled** (per v4.1 Section 6's decision, now implemented — shared across all children on a parent account via a single `family_usage` row), with lazy weekly/daily resets triggered on request rather than a cron dependency. Live snapshots are tracked as a **discrete count** (3/week free), separate from voice minutes (5/week free) — these are currently two independent limits, not one unified allowance.

### 0.5 Billing (confirmed in `mobile/src/services/billing.ts` and `backend/src/routes/billing.ts`)
RevenueCat is fully wired: a single `premium` entitlement, webhook-driven (`INITIAL_PURCHASE`/`RENEWAL`/`UNCANCELLATION`/`PRODUCT_CHANGE` → `is_premium = true`; `EXPIRATION`/`BILLING_ISSUE` → `is_premium = false`). This matches v3's Stripe→RevenueCat swap and is further along than v4.1 indicated — billing itself looks done, not partial.

### 0.6 Backend routes/services present
```
routes:  admin.ts  auth.ts  billing.ts  chat.ts  homework.ts  students.ts  transcript.ts
lib:     cache.ts  gemini.ts  geminiLive.ts  homeworkStorage.ts  retentionCleanupJob.ts
         supabase.ts  threadImageStore.ts  usageEvents.ts  usageLimits.ts  voiceLimits.ts
         voiceSocketServer.ts
```
Both `cache.ts` (Redis/response caching, v4.1 ticket 5.7) and `usageEvents.ts` (DAU/MAU tracking, v4.1 ticket 5.8) exist as files — **presence confirmed, functional completeness not verified.** [UNVERIFIED — confirm actual implementation depth before marking Phase 5 fully done]

---

## 1. What's Changing in v5

| Area | v4.1 | v5.0 |
|---|---|---|
| Homework image input | Single static upload flow (Phase 3), described as the only path | **Three overlapping paths exist in reality** — consolidating to one primary flow (Section 2) |
| Free voice allowance | 5 min/week | **10 min/week** (your requested change) |
| Free live-vision allowance | Separate discrete counter, 3 snapshots/week | **Folded into the same 10 min/week allowance** — see Section 3 for why and how |
| Tier framing | Voice and "live photo-help" marketed/limited somewhat separately | **Single unified "Talk & Show" allowance** — simpler to explain to parents, simpler to enforce, matches how the feature is actually used (voice + camera together in one call, not two separate features) |
| UI-hang bug | Not previously identified | **New Section 4 — root-cause hypothesis and fix plan** |
| Screen count | 11-screen prototype target | **Unchanged target, but Scan/Homework as a separate top-level screen is being deprecated in favor of routing through Live Voice** (Section 2) |

---

## 2. Consolidation Decision: One Flow, Not Three

**Decision:** Deprecate `HomeworkScreen.tsx` as a separately-launched flow. Keep live camera + instant snapshot + gallery-picker fallback **inside `LiveVoiceScreen.tsx`** as the single way to show Kidsko something, whether or not the child is actively mid-conversation.

**Why:** A parent/child currently has to decide upfront "am I going to Call or am I going to Scan?" — but functionally, showing homework *is* part of talking to Kidsko now, not a separate activity. Keeping both confuses the mental model and doubles your surface area for bugs (you're now maintaining two image-capture pipelines instead of one).

**What changes concretely:**
- Home screen: remove the standalone `📸 Scan` button per student row. Keep only `🎙️ Call`, `Chat`, `Transcript`.
- `LiveVoiceScreen.tsx` becomes the single entry point for anything visual — live camera, instant snapshot, and gallery fallback all already live there; no new UI needed, just removing the redundant entry point.
- `HomeworkScreen.tsx` and its backend route (`homework.ts`) are **not deleted** — kept as-is for now since `chat.ts`/`ChatScreen.tsx` may still reference the same underlying image-analysis pipeline for non-voice text chat (a child typing instead of calling should still be able to attach a photo). Confirm this dependency before removing anything. [UNVERIFIED — confirm ChatScreen's image-attach path before deprecating HomeworkScreen's backend route]

---

## 3. New Unified Tier: 10 Min/Week Free, Then Paid (Voice + Video Together)

**Your request:** 10-minute free weekly trial, covering both voice and video, then paid for both.

**Implementation approach:** Fold the separate `FREE_WEEKLY_LIVE_SNAPSHOTS` counter into the same time-based `weekly_voice_minutes_used` counter that already governs voice — since a live-vision call is just a voice call with the camera on, metering them as one allowance is both simpler to build and easier for a parent to understand ("10 minutes a week free, for talking or showing homework") than two separate limits with different units (minutes vs. snapshot count).

```ts
// voiceLimits.ts — proposed changes
export const FREE_WEEKLY_VOICE_MINUTES = 10;   // was 5 — your requested change
export const PREMIUM_WEEKLY_VOICE_MINUTES = 25; // unchanged, confirm still adequate with combined usage

// Discrete snapshot counters (FREE_WEEKLY_LIVE_SNAPSHOTS / PREMIUM_WEEKLY_LIVE_SNAPSHOTS)
// become unnecessary once video time draws from the same pool as voice time —
// remove checkSnapshotEligibility/recordSnapshotUsed's separate limit, OR keep the
// snapshot counter only as a soft internal safeguard against a single session
// hammering the instant-snapshot button (cost-control, not a user-facing limit).
```

**Open decision — confirm before implementing:** Do "instant snapshot" taps (discrete, cheap) and "live camera streaming" (continuous, more expensive per your v4.1 cost model — the 2.5s-interval loop sends a frame roughly every 2.5s of listening time) draw from the same minute pool at the same rate, or does continuous streaming burn the allowance faster? Given the real cost asymmetry noted in v4.1 (continuous video tokenizes far more expensively than audio-only), I'd recommend: **voice-only time and camera-active time both count against the same 10-minute pool, but camera-active time could optionally count at an accelerated rate (e.g., 1.5x or 2x) if real cost data justifies it.** Don't build the accelerated-rate part speculatively — ship the simple 1:1 version first, check actual Gemini cost logs after a week of real usage, then adjust the rate if needed. **[Founder decision needed before Ticket 3 below]**

**Paywall messaging update:** Update `PaywallScreen.tsx` copy to reflect "10 minutes free every week — talk to Kidsko or show your homework live" rather than describing voice and photo-help as two separate free allowances.

---

## 4. UI-Hang Bug — Fix Plan

Building on the hypothesis in Section 0.3:

| Ticket | Action | Definition of Done |
|---|---|---|
| **4.1 — Confirm the hypothesis with real logs** | Reproduce the hang on a real device with full console logging active. Confirm whether the last log line before the freeze is always the camera capture call, and whether any log line appears *after* the alleged 2.5s JS timeout should have fired. | Either confirmed (freeze always follows a camera capture with no timeout log appearing after) or ruled out (timeout does fire, freeze happens elsewhere) — written up before touching code. |
| **4.2 — Replace JS-level Promise.race with true capture cancellation** | If confirmed: investigate whether `expo-camera`'s `takePictureAsync` exposes an actual cancellation token or abort mechanism, rather than relying on a JS timeout that can't stop the native call. If no native cancellation exists, consider reducing capture resolution/quality specifically for the live-loop captures (separate from instant-snapshot quality) to reduce the chance of the native call stalling in the first place. | A stress test — forcing repeated rapid captures on a lower-end real device — no longer produces a frozen UI; worst case is a skipped frame, not a dead app. |
| **4.3 — Decouple UI responsiveness from camera loop entirely** | Regardless of 4.2's outcome, ensure the camera capture loop cannot block button presses / state updates even in a worst case — e.g., ensure it's not accidentally running on the same synchronous execution path as UI event handlers. Add a hard ceiling: if 3 consecutive capture attempts fail/timeout, auto-disable the live camera loop and show a message ("Live camera paused — tap to retry") rather than continuing to retry silently into the same freeze. | Simulated 3x-consecutive-failure test results in a clean auto-disable with a visible message, not a hang. |
| **4.4 — Add Sentry breadcrumbs specifically around camera capture timing** | Log capture start/end/duration for every loop iteration (sampled, not every single one, to avoid noise) so that if this happens again post-launch, you have real timing data instead of needing to reproduce it live. | Breadcrumbs visible in Sentry from a test session showing capture durations. |

**This is a blocking bug** — it directly undermines the live-video feature you just built to replace image upload, so it should be fixed before the consolidation in Section 2 ships, or you'll be pointing everyone at the one flow most likely to freeze.

---

## 5. Status Against v4.1's Phases — Updated

| Phase | v4.1 status | v5.0 status (from direct repo check) |
|---|---|---|
| 0 — Setup | ✅ Done | ✅ Confirmed still done |
| 1 — Auth & data model | ✅ Done | ✅ Confirmed still done |
| 2 — Text chat | ✅ Done | ✅ Confirmed still done |
| 3 — Homework scan | ✅ Done | 🟡 **Done but now redundant** — see Section 2 consolidation |
| 4 — Voice (basic) | ✅ Done | ✅ Confirmed, plus hardening fixes from the separate voice-stability plan in progress |
| 4B — Real-time voice | Planned, not started in v4.1 | ✅ **Now built** — `voiceSocketServer.ts`, `LiveVoiceScreen.tsx`, live camera loop all exist |
| 4C — Live voice + homework snapshot | Planned, not started in v4.1 | ✅ **Now built** — this is the live camera + instant snapshot feature; the "video instead of image upload" work you did |
| 5 — Limits & billing | 🟡 Partial in v4.1 | 🟡 **Further along than v4.1 stated** — RevenueCat fully wired, voice/snapshot limits implemented, family-pooling implemented. Caching (`cache.ts`) and usage tracking (`usageEvents.ts`) exist as files but completeness unverified. Free parent transcript view — `TranscriptScreen.tsx` exists, gating logic not verified. |
| 6 — Polish & safety | ⬜ Not started in v4.1 | ⬜ **Still not started** — no Settings/Notifications/Dark Mode/Language screens exist |
| 7 — Store submission | ⬜ Not started | ⬜ **Still not started**, and now additionally blocked on the voice-stability Tier 0/1/2 plan and this document's Section 4 |

**Net honest read:** you've actually moved *faster* on the voice/video features than v4.1 assumed (4B and 4C are both substantially built, not just planned), but that speed is exactly why things feel confusing — new flows were added alongside old ones instead of replacing them, and Phase 6 polish (which would normally catch this kind of drift) hasn't started yet.

---

## 6. This Sprint's Ticket List

| # | Ticket | Depends on | Priority |
|---|---|---|---|
| 1 | Confirm UI-hang root cause with real device logs (Section 4.1) | — | **Blocking — do first** |
| 2 | Fix camera capture freeze (Section 4.2–4.4) | 1 | **Blocking** |
| 3 | Decide accelerated-rate question for camera-active minutes (Section 3) | Founder input | Before ticket 4 |
| 4 | Update `FREE_WEEKLY_VOICE_MINUTES` to 10, fold snapshot limit into unified pool | 3 | High |
| 5 | Remove standalone `📸 Scan` button from `HomeScreen.tsx` | 2 (don't ship consolidation on a freezing flow) | High |
| 6 | Update `PaywallScreen.tsx` copy for the unified 10-min messaging | 4 | Medium |
| 7 | Confirm `ChatScreen.tsx`'s relationship to `HomeworkScreen.tsx`/`homework.ts` before deciding whether to fully retire the old screen or keep its backend route alive for text-chat image attachments | — | Medium |
| 8 | Verify `cache.ts` and `usageEvents.ts` are functionally complete, not just present | — | Medium (needed before Phase 6 sign-off) |

---

## Bottom Line

The confusion you're feeling isn't a misreading of the project — it's real, and it's specifically because 4B/4C (real-time voice and live camera) got built as genuinely new, more capable flows sitting *next to* the original Phase 3 image-upload flow instead of replacing it. Two things need to happen: fix the camera-capture freeze first (Section 4), since it's the reason the new flow can't yet fully replace the old one with confidence, then do the consolidation (Section 2) once that's solid. The 10-minute unified free allowance (Section 3) is a straightforward change once you decide whether camera-active time should burn the pool faster than voice-only time — that's the one open decision this plan needs from you before Ticket 4 can be built.