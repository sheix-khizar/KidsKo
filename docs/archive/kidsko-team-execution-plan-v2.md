# Kidsko.ai — Team Execution Plan (v2.0)
**Updated: RevenueCat billing swap + security/optimization tickets found during code audit**
Supersedes Team Execution Plan v1.0. Ticket numbering unchanged where possible; new tickets inserted with letter suffixes (e.g., 0.5a) so existing boards aren't renumbered.

---

## What Changed Since v1.0

- Ticket 0.5 (Stripe account) → **replaced with RevenueCat project setup**
- New tickets added: 0.6a (rate limiting + helmet), 1.6a (RLS session context fix), 2.8/2.9 (per-user throttle + history trimming), 5.7/5.8 (caching, expanded usage tracking), 6.6 (account deletion)
- Tickets 5.4/5.5 (Stripe Checkout + webhook) → **replaced with RevenueCat equivalents**

---

## Phase 0 — Environment & Infrastructure Setup (Updated)

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 0.1 — Initialize Expo TypeScript project (SDK 57) | FE | — | 2 hrs | `npx expo start` runs, app loads on a real device via Expo Go |
| 0.2 — Initialize Node.js/Express TS backend | BE | — | 3 hrs | `GET /health` returns `200 OK` locally |
| 0.3 — Create Supabase project + enable Auth | BE | — | 1 hr | Supabase dashboard shows empty project, Auth toggle is on |
| 0.4 — Create 2 Gemini API keys (free-tier dev + billed prod, 2 separate GCP projects) | BE | — | 1 hr | Both keys tested via `curl`, saved in `.env` |
| **0.5 — Create RevenueCat project** *(replaces Stripe)* | BE | — | 1 hr | RevenueCat project exists, public API key saved in `.env` |
| 0.6 — Set up Git repo, branch strategy, `.env.example` | PM or BE | — | 1 hr | Repo exists with `main`/`dev` branches, no real secrets committed |
| **0.7 (new) — Install `express-rate-limit` + `helmet`, apply globally** | BE | 0.2 | 1 hr | Both packages in `package.json`; `helmet()` and a base rate limiter applied in `server.ts` |

**Phase 0 Exit KPI:** ✅ Expo app runs on a phone AND hits the local backend's `/health` endpoint AND two distinct Gemini keys exist AND helmet/rate-limit middleware is active.

---

## Phase 1 — Authentication & Data Model (Updated)

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 1.1 — Create `profiles` table (with RLS enabled) | BE | 0.3 | 2 hrs | Table visible in Supabase Table Editor with correct columns |
| 1.2 — Create `students` table (with RLS enabled) | BE | 1.1 | 2 hrs | Table visible, foreign key to `profiles` works |
| **1.2a (new) — Write and verify RLS `insert` policies for both tables** | BE | 1.1, 1.2 | 2 hrs | A test insert using a real user JWT succeeds; a test insert using no session/anon-only fails as expected |
| 1.3 — Wire Register screen to Supabase Auth | FE + BE | 1.1 | 1 day | New signup creates `auth.users` + `profiles` rows |
| **1.3a (new) — Ensure backend forwards user session to Supabase client on writes**, not just the anon key | BE | 1.3 | 0.5 day | Registration succeeds end-to-end against RLS-protected tables, confirmed via direct DB check |
| 1.4 — Wire Login screen | FE + BE | 1.3 | 0.5 day | Returning user logs in, JWT stored via `expo-secure-store` |
| 1.5 — Add student sub-profile creation flow | FE + BE | 1.2 | 1 day | Parent can add ≥1 student; row appears in `students` |
| 1.6 — Add backend JWT-verification middleware | BE | 1.3 | 0.5 day | Any API call without a valid token returns `401` |

**Phase 1 Exit KPI:** ✅ A real user can register, create a student profile, log out, log back in, land on chat already authenticated — with the RLS insert bug confirmed fixed, not just the auth flow.

---

## Phase 2 — Core Text Chat (Updated, 2 new tickets)

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 2.1 — Build `POST /api/chat` route calling `gemini-3.1-flash-lite` | BE | 1.6 | 1 day | Given `{studentId, message}`, returns a real Gemini reply |
| 2.2 — Write & apply Kidsko system prompt | BE + PM | 2.1 | 0.5 day | 5 test questions return safe, age-appropriate, Socratic answers |
| 2.3 — Create `messages` and `chat_threads` tables | BE | 1.2 | 0.5 day | Tables exist, linked to `students` |
| 2.4 — Persist every message sent/received | BE | 2.1, 2.3 | 0.5 day | Reopening app after closing shows prior messages |
| 2.5 — Connect chat input UI to real `/api/chat` | FE | 2.1 | 1 day | Typing + sending returns a live AI reply |
| 2.6 — Sidebar shows real threads grouped by date | FE | 2.4 | 1 day | Reflects real DB data, not mock entries |
| 2.7 — New Chat button creates a new thread | FE | 2.6 | 0.5 day | Starting new chat doesn't overwrite the previous one |
| **2.8 (new) — Add per-user rate limiter on `/api/chat`** (e.g. 10 req/min) | BE | 2.1 | 0.5 day | 11th request within a minute from the same user gets a friendly "slow down" message, not a raw error |
| **2.9 (new) — Trim chat history to last ~10 messages before sending to Gemini** | BE | 2.4 | 0.5 day | A 50-message thread's outbound Gemini payload size stays roughly constant, confirmed via logged token counts |

**Phase 2 Exit KPI:** ✅ A logged-in user can hold a real, sustained conversation with the AI (including long threads), it persists after force-closing the app, and it's protected from single-user burst abuse.

---

## Phase 3 & 4 — Unchanged from v1.0
(Photo scanning and voice input/output — no security or billing changes apply here. See Team Execution Plan v1.0 for full ticket detail.)

---

## Phase 5 — Usage Limits, Tier Enforcement & Billing (Updated — Stripe replaced, 2 new tickets)

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 5.1 — Add `daily_message_count`/`daily_scan_count` enforcement server-side | BE | Phase 3, 4 | 1 day | Backend rejects 11th message/4th scan with `429` |
| 5.2 — Sync usage-pill badge to real server counts | FE | 5.1 | 0.5 day | Badge matches DB after every message/scan |
| 5.3 — Add parental gate before Paywall screen | FE | — | 0.5 day | Child cannot reach payment screen without solving the gate |
| **5.4 — Wire Paywall to RevenueCat purchase flow** *(replaces Stripe Checkout)* | FE + BE | 5.3 | 1 day | "Upgrade" opens native Apple/Google purchase sheet via RevenueCat SDK |
| **5.5 — Build RevenueCat webhook handler** *(replaces Stripe webhook)* | BE | 5.4 | 1 day | Successful test purchase flips `is_premium = true` |
| 5.6 — Build midnight reset job | BE | 5.1 | 0.5 day | Manually triggering resets all counters to 0 |
| **5.7 (new) — Add basic response caching** for common/repeated questions | BE | 2.1 | 1 day | Identical repeated questions served from cache; reduced Gemini call count confirmed in logs |
| **5.8 (new) — Expand usage tracker to DAU/MAU + cost-per-feature** | BE | 5.1 | 1 day | A query/dashboard shows daily/monthly active users and cost split between chat vs. image scans |
| **5.9 (new) — Add per-user rate limiter on `/api/analyze-homework`** | BE | Phase 3 | 0.5 day | Same throttle pattern as ticket 2.8, applied to the image-scan endpoint |

**Phase 5 Exit KPI:** ✅ You hit the free limit, pass the parental gate, complete a real (sandbox) RevenueCat test purchase, and immediately send an 11th message successfully — with caching and per-user throttling both verified active.

---

## Phase 6 — Polish, Settings Completion & Safety Pass (Updated, 1 new ticket)

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 6.1 — Wire remaining Settings screens to real backend calls | FE + BE | Phase 5 | 1.5 days | Zero mock data remains anywhere in the app |
| 6.2 — Run adversarial AI safety test (10 jailbreak prompts) | PM | Phase 2 | 0.5 day | AI safely redirects 10/10 times |
| 6.3 — Accessibility pass (44x44pt tap targets, font scaling) | FE | Phase 5 | 0.5 day | All primary buttons meet minimum tap size |
| 6.4 — Real device test (≥1 iOS, ≥1 Android) | PM | 6.1 | 0.5 day | No broken layouts on either device |
| 6.5 — COPPA data-retention audit | PM + BE | Phase 5 | 0.5 day | No raw voice/image files persist beyond processing |
| **6.6 (new) — Build account/data deletion endpoint** | BE | 1.6 | 1 day | A user can trigger full deletion of their profile, students, and messages; confirmed via DB check post-deletion |

**Phase 6 Exit KPI:** ✅ Zero mock content anywhere; full signup → chat → scan → upgrade → settings → delete-account flow works without a crash.

---

## Phase 7 — Store Submission & Launch (Updated: RevenueCat instead of Stripe key switch)

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 7.1 — Switch backend to the billed Gemini key (`.env.production`) | BE | Phase 6 | 0.5 hr | Verified: production traffic uses paid tier, not free tier |
| 7.2 — Configure EAS Build | FE | Phase 6 | 0.5 day | Produces signed iOS `.ipa` and Android `.aab` |
| 7.3 — Prepare store listings, Privacy Policy, Data Safety Form | PM | — | 1–2 days | Listings live with all required disclosures, including account-deletion instructions (ticket 6.6) |
| 7.4 — Submit for review (Apple Kids Category + Google Families) | PM | 7.2, 7.3 | 0.5 day (+ review wait) | App is In Review on both stores |
| **7.4a (new) — Configure RevenueCat production entitlements for both stores** | BE | 5.4, 5.5 | 0.5 day | Production RevenueCat project correctly linked to live App Store Connect + Play Console subscription products |
| 7.5 — Recruit 5–10 real test families | PM | 7.4 | ongoing | 5+ real users complete signup + send ≥1 message |
| 7.6 — Collect structured feedback | PM | 7.5 | 0.5 day | 1-page feedback log with real notes |

**Phase 7 Exit KPI:** ✅ App is live (or in TestFlight/Internal Testing), running on the billed Gemini tier, billing works through RevenueCat/native IAP, and 5 real families have used it.

---

## Quick Reference: Every New/Changed Ticket in v2.0

| Ticket | What it fixes |
|---|---|
| 0.5 | Stripe → RevenueCat (Pakistan billing fix) |
| 0.7 | Missing API abuse protection (helmet + rate limiting) |
| 1.2a, 1.3a | Real RLS bug: backend inserts were failing silently under Row Level Security |
| 2.8, 5.9 | Per-user AI request throttling — protects your shared Gemini RPM quota from single-user bursts |
| 2.9 | Unbounded chat history growth → rising per-message cost |
| 5.4, 5.5 | Stripe → RevenueCat (billing flow + webhook) |
| 5.7 | Response caching, promoted from optional to required |
| 5.8 | Usage tracking expanded beyond aggregate spend |
| 6.6 | Account deletion — real endpoint, not just a policy statement |
| 7.4a | RevenueCat production configuration for both app stores |
