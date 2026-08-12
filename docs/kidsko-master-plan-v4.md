# Kidsko.ai — Master Plan (v4.1)
**Updated for: revised free/premium tiers, free parent transcript view, Redis response caching, real-time voice deferred to its own phase, family-pooled usage, recurring weekly voice allowance, and new Phase 4C (live voice + homework snapshot)**
Supersedes v4.0. Architecture, SRS, and legal sections from v3 carry over unchanged unless noted below. This document reflects the actual state of the `dev` branch as of this writing (Phases 0–4 built, Phase 5 partial), plus real Askie pricing-page data (screenshot reviewed directly) used to sanity-check limits and margins.

---

## 0. Current Repo Status (Ground Truth)

Confirmed by direct inspection of `sheix-khizar/KidsKo` (`dev` branch):

| Phase | Status | Notes |
|---|---|---|
| 0 — Setup | ✅ Done | helmet + express-rate-limit active, Expo TS app scaffolded |
| 1 — Auth & data model | ✅ Done | auth.ts, students.ts, JWT middleware, Register/Login/Home screens |
| 2 — Text chat | ✅ Done | chat.ts, history trimmed to last 10 msgs, per-user rate limiter |
| 3 — Homework scan | ✅ Done | homework.ts, Sharp compression, imageRateLimit, HomeworkScreen.tsx |
| 4 — Voice (basic) | ✅ Done | useVoiceInput.ts, expo-speech + expo-speech-recognition |
| 5 — Limits & billing | 🟡 Partial | usageLimits.ts + ParentalGate.tsx done; **RevenueCat, caching, DAU/MAU tracking, transcript view all missing** |
| 6 — Polish & safety | ⬜ Not started | No Settings screens, no account deletion endpoint |
| 7 — Store submission | ⬜ Not started | — |

**No RevenueCat SDK, no Redis, no Settings/Paywall/History screens exist in the mobile app yet.**

---

## 1. What Changed in v4

| Item | v3 | v4 |
|---|---|---|
| Free tier limits | 10 msg/day, 3 scans/day | **30 msg/day, 5 scans/day** — old limit was too restrictive for real homework help |
| Real-time voice | Not specified | **New Premium differentiator.** Free tier gets 3 trial sessions (5 min each, server-enforced kill switch). Premium gets a monthly minute allowance (size after pilot data — do not promise unlimited) |
| Voice architecture | Chained STT → Gemini → TTS (Phase 4, already built) | **Real-time voice is a separate build (Phase 4B)** using Gemini's native Live API (WebSocket, bidirectional audio) — architecturally distinct from Phase 4, not an extension of it |
| Parent dashboard | Premium-gated ("Basic" free / "Full" premium) | **Basic transcript/conversation view is free for everyone** (trust/safety feature, matches competitor positioning). Only advanced analytics (weekly email, subject breakdowns, streak tracking) stays Premium |
| Response caching | Optional/required but unspecified mechanism | **Redis (Upstash) normalized-match cache** on `/api/chat` only — not homework image analysis. Key by normalized question text + grade band, 30-day TTL |
| Unit economics | ~80–90% margin assumed (text/image only) | **Recalculated with voice**: Premium COGS is closer to $3.50–4.50/month once voice allowance is included (text/scans ~$1–2 + voice ~$2.30 at 100 min/month allowance) → **~55–65% margin**, still healthy but must be tracked, not assumed |
| Free-tier real-time voice | 3 one-time trial sessions, gone forever after use | **Recurring: 5 min/week, every week** — matches Askie's proven model, same cost ceiling, better retention (feature never fully disappears) |
| Usage pooling | Per-child counters (`students` table) | **Default: family-pooled** (one quota shared across all children on a parent account), matching Askie's "one plan for all your children" model. **This is a default, not a locked decision** — flagged for founder override before Phase 5 ships, since reversing it later requires a schema migration |
| Live vision during voice calls | Not addressed | **New Phase 4C** — live voice + single-photo homework snapshot (not continuous video streaming). See Section 6 |

---

## 2. Updated Tier Table

| Feature | Free | Premium — $9.99/mo |
|---|---|---|
| Text messages | 30/day (210/week) | 2,000/month |
| Homework photo scans | 5/day | Higher cap (TBD after pilot) |
| Basic voice (STT→Gemini→TTS) | ✅ | ✅ |
| Real-time voice | **5 min/week, recurring (server-enforced)** | Monthly minute allowance (size after cost pilot — do not copy Askie's 200 min/week at face value, see cost note below) |
| Live voice + homework snapshot (Phase 4C) | — | Post-launch addition, gate TBD |
| Parent transcript view | ✅ | ✅ |
| Progress analytics / weekly email | — | ✅ |
| Response caching benefit | ✅ (applies to all users, cost-saving not user-facing) | ✅ |
| Usage scope | **Pooled across all children on the account (default — confirm before Phase 5 ships)** | Pooled |

---

## 3. Updated Cost Model

| Scenario | Est. monthly cost |
|---|---|
| Heavy free-tier user (30 msg + 5 scans/day, all 3 voice trials used) | ~$0.60–0.90 (text/scans) + ~$0.35 one-time (voice trials) |
| Premium user (2,000 msg/mo + scans + 100 min real-time voice) | ~$1–2 (text/scans) + ~$2.30 (voice) = **~$3.50–4.50/month** |
| Gross margin at $9.99/mo | **~55–65%** (down from v2/v3's 80–95% estimate — voice is the driver) |

**Real-time voice pricing reference (Gemini 3.1 Flash Live):** $3/1M audio input tokens, $12/1M audio output tokens ≈ $0.005/min in + $0.018/min out ≈ **$0.023/min combined**. Recheck this before finalizing the Premium voice allowance — pricing on preview/Live models moves faster than standard text models.

**Competitor sanity check (Askie pricing page, reviewed directly):** Their Premium tier ($14.99/mo) advertises 200 voice min/week (~866 min/month). At our $0.023/min rate that's ~$19.90/month in raw voice cost alone — *more than the subscription price itself* if a user maxed it out. Two explanations: (a) almost nobody hits the stated cap in practice, or (b) they have better negotiated rates than public pricing. **Do not size your own voice allowance off their published numbers — use your own pilot usage data instead.**

**Video/live-vision cost confirmation:** Even on Askie's $14.99 Premium tier, live video is capped at 5 min/week and explicitly labeled "(trial)" — full video access requires their $39.99/mo "Premium Max" tier. This independently confirms continuous live video is far more expensive than audio (video tokenizes at roughly 100–200x the rate of audio per second on comparable models). This is why Phase 4C (below) uses a single still photo inside a live voice call instead of continuous video streaming — same "wow" effect, a small fraction of the cost.

---

## 4. New/Updated Tickets for This Sprint

### Phase 5 — Remaining Work (build in this order)

| Ticket | Depends On | Definition of Done |
|---|---|---|
| 5.0a (new) — Update `usageLimits.ts` constants to 30 msg/day, 5 scans/day | — | Free user's 31st message and 6th scan of the day return `429` |
| 5.4 — Wire Paywall to RevenueCat purchase flow | 5.3 (parental gate, already done) | "Upgrade" opens native Apple/Google purchase sheet via RevenueCat SDK |
| 5.5 — Build RevenueCat webhook handler | 5.4 | Successful test purchase flips `is_premium = true` |
| 5.10 (new) — Build free parent transcript view | 2.4 (messages table, already done) | Parent can view a read-only list of their child's chat history, gated only by the existing parental math-gate, not by `is_premium` |
| 5.7 — Add Redis (Upstash) response caching on `/api/chat` | 2.1 | Identical normalized questions served from cache; reduced Gemini call count confirmed in logs; homework endpoint explicitly excluded |
| 5.8 — Expand usage tracker to DAU/MAU + cost-per-feature (incl. voice trial cost) | 5.1 | Dashboard/query shows daily/monthly active users and cost split between chat, scans, and voice |
| 5.9 — Per-user rate limiter on `/api/analyze-homework` | Phase 3 (done) | Same throttle pattern as chat limiter |

**Phase 5 Exit KPI:** ✅ Free/premium limits match the new tier table, a real (sandbox) RevenueCat purchase flips premium status, the parent can view a transcript without paying, repeated common questions are served from cache, and voice trial cost is visible in your usage dashboard.

### Phase 4B (new) — Real-Time Voice
**Entry Gate:** Phase 5 fully complete and shipped (revenue loop proven first)
**Depends on:** RevenueCat integration (5.4/5.5) for gating

| Ticket | Definition of Done |
|---|---|
| 4B.1 — Integrate Gemini Live API client (WebSocket audio streaming) | A test session can send/receive live audio round-trip |
| 4B.2 — Server-side session cap enforcement | Backend force-terminates any session at 5 min (trial) or the Premium allowance limit — verified with a client that ignores the cap |
| 4B.3 — Trial counter (3 sessions, one-time) | 4th trial attempt is blocked with an upgrade prompt |
| 4B.4 — Premium voice-minute allowance tracking | Premium user's remaining voice minutes are queryable and enforced |
| 4B.5 — Barge-in / interruption handling | Child can interrupt the AI mid-response without the session breaking |

**Phase 4B Exit KPI:** ✅ A free user gets a recurring 5 min/week real-time voice allowance (enforced server-side even with a hostile client, resets weekly not one-time), and a Premium user's usage is metered against their monthly allowance.

### Phase 4C (new) — Live Voice + Homework Snapshot
**Entry Gate:** Phase 4B fully shipped
**Rationale:** Askie offers live voice and separately offers async homework-photo help, but does not combine them — likely because continuous live video is too expensive and too low-resolution to reliably read handwriting. This phase closes that gap cheaply by inserting a single still photo (reusing the existing Phase 3 Sharp-compression pipeline) into an active Phase 4B voice session, instead of streaming continuous video.

| Ticket | Definition of Done |
|---|---|
| 4C.1 — Add in-call "capture" trigger to the live voice UI | Tapping it captures one still frame without ending the voice session |
| 4C.2 — Route captured frame through existing Sharp compression pipeline | Captured image is compressed identically to the Phase 3 homework-scan flow |
| 4C.3 — Inject compressed image into the active Live session as context | The AI's next spoken response accurately references content from the captured photo |
| 4C.4 — Cost tracking for this flow | Per-snapshot cost is logged separately in the usage dashboard (ticket 5.8) so it doesn't get silently absorbed into general voice-minute cost |

**Phase 4C Exit KPI:** ✅ A child in an active real-time voice call can trigger a photo capture and have the AI respond by voice about the contents of that photo, with per-snapshot cost visible and no continuous video streaming involved.

---

## 5. Sequencing Rule (Don't Skip This)

**Finish Phase 5 completely before starting Phase 4B. Finish Phase 4B completely before starting Phase 4C.** Real-time voice is your single largest new cost and engineering complexity item — you want RevenueCat billing live and proven *before* you add the feature most likely to erode margin if something goes wrong (e.g. a session that isn't properly capped). Phase 4C then reuses 4B's session plumbing directly, so building it earlier would mean rebuilding it.

---

## 6. Open Decision — Confirm Before Phase 5 Ships

**Family-pooled vs. per-child usage limits.** This document currently defaults to **pooled** (one quota shared across all children on a parent account), matching Askie's model and your multi-child-profile plans. This is a *default assumption, not a final decision* — if you want per-child limits instead, say so before Phase 5 work begins, because switching after launch requires a schema migration on the `students`/usage-tracking tables rather than a config change.

---

## Bottom Line

The shape of the plan hasn't changed — same phases, same eventual scope. What changed in v4.1: friendlier free-tier limits validated against a real competitor, real-time voice promoted to a first-class (but cost-guarded and deferred) Premium feature now with a recurring weekly allowance instead of a one-time trial, the parent dashboard un-paywalled for trust reasons, response caching specified concretely, a new cost-controlled Phase 4C (live voice + homework snapshot) that closes a real gap in Askie's own feature set, and a flagged-but-not-final default toward family-pooled usage. Next concrete action: confirm or override the pooling default (Section 6), update `usageLimits.ts` constants, then start the RevenueCat integration.
