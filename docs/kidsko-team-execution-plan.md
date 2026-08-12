# Kidsko.ai — Team Execution Plan
**Ticket-level breakdown of the KPI roadmap, built so a team can pick it up and start working today.**

This document turns each Phase from the Master Plan into individual, assignable tickets — each with an owner role, dependencies, time estimate, and a single Definition of Done. Copy each ticket row directly into Trello/Linear/GitHub Projects as one card.

---

## 1. The Flow at a Glance

```
PHASE 0            PHASE 1           PHASE 2              PHASE 5              PHASE 6           PHASE 7
Setup       ──►     Auth       ──►    Text Chat    ──┬──►  Limits &     ──►     Polish &   ──►    Launch
(2-3 days)          (3-5 days)        (5-7 days)      │    Paywall             Safety Pass        (3-7 days)
                                                       │    (4-5 days)         (3-5 days)
                                                       │
                                       ┌───────────────┴───────────────┐
                                       │                               │
                                  PHASE 3                         PHASE 4
                                  Photo Scan                      Voice In/Out
                                  (4-6 days)                      (2-3 days)
                                       │                               │
                                       └───────────────┬───────────────┘
                                                        ▼
                                                  (both feed into Phase 5)
```

**Read this as:** Phases 0 → 1 → 2 must happen strictly in order — each depends on the one before. Once Phase 2 is done, **Phase 3 and Phase 4 can run at the same time** on two different people (they don't depend on each other). Both must finish before Phase 5 starts. From there, 5 → 6 → 7 are strictly sequential again.

This is the **only real parallelization opportunity** in the whole roadmap — plan your team size around it.

---

## 2. Roles Used in This Plan

| Role | Owns | Core Skills Needed |
|---|---|---|
| **Backend Dev (BE)** | API routes, database, AI integration, billing logic | Node.js/Express, TypeScript, Supabase, REST APIs |
| **Mobile/Frontend Dev (FE)** | App screens, navigation, camera/voice UI wiring | React Native, Expo, TypeScript |
| **Product/QA (PM)** | Safety testing, store submission, coordinating, prompt tuning | No coding required — this can be you, even if BE/FE are contractors |

**Team size options:**
- **Solo:** You are BE + FE + PM, working phases in strict order — no parallelization, ~5–6 weeks
- **2-person:** One BE, one FE, you act as PM part-time — Phases 3/4 still run sequentially (only 2 people, no one free to parallelize) unless one person context-switches — ~4–5 weeks
- **3-person:** One BE, one FE, one PM (you) — Phases 3 and 4 run in **true parallel** (BE builds Phase 3's backend while FE builds Phase 4's voice UI, then swap) — ~3.5–4 weeks
- **4-person:** Two BE/FE pairs — Phase 3 fully owned by one pair, Phase 4 by the other, simultaneously — ~3 weeks

---

## 3. Phase 0 — Environment & Infrastructure Setup
**Depends on:** Nothing — this is day one.
**Can start:** Immediately.

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 0.1 — Initialize Expo TypeScript project (SDK 57) | FE | — | 2 hrs | `npx expo start` runs, app loads on a real device via Expo Go |
| 0.2 — Initialize Node.js/Express TS backend | BE | — | 3 hrs | `GET /health` returns `200 OK` locally |
| 0.3 — Create Supabase project + enable Auth | BE | — | 1 hr | Supabase dashboard shows empty project, Auth toggle is on |
| 0.4 — Create 2 Gemini API keys (free-tier dev + billed prod) | BE | — | 1 hr | Both keys tested via `curl`, saved in `.env.development` / `.env.production` |
| 0.5 — Create Stripe test account + one test product | BE | — | 1 hr | Stripe Test Mode active, $9.99/mo product exists |
| 0.6 — Set up Git repo, branch strategy, `.env.example` | PM or BE | — | 1 hr | Repo exists with `main`/`dev` branches, no real secrets committed |

**Phase 0 Exit KPI:** ✅ Expo app runs on a phone AND hits the local backend's `/health` endpoint AND two distinct Gemini keys exist.

---

## 4. Phase 1 — Authentication & Data Model
**Depends on:** Phase 0 complete.
**Can start:** As soon as 0.1–0.6 are all done.

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 1.1 — Create `profiles` table | BE | 0.3 | 2 hrs | Table visible in Supabase Table Editor with correct columns |
| 1.2 — Create `students` table | BE | 1.1 | 2 hrs | Table visible, foreign key to `profiles` works |
| 1.3 — Wire Register screen to Supabase Auth | FE + BE | 1.1 | 1 day | New signup creates `auth.users` + `profiles` rows |
| 1.4 — Wire Login screen | FE + BE | 1.3 | 0.5 day | Returning user logs in, JWT stored via `expo-secure-store` |
| 1.5 — Add student sub-profile creation flow | FE + BE | 1.2 | 1 day | Parent can add ≥1 student; row appears in `students` |
| 1.6 — Add backend JWT-verification middleware | BE | 1.3 | 0.5 day | Any API call without a valid token returns `401` |

**Phase 1 Exit KPI:** ✅ A real person can register, create a student profile, log out, log back in, and land on chat already authenticated.

---

## 5. Phase 2 — Core Text Chat (Gemini 3.1 Flash-Lite)
**Depends on:** Phase 1 complete.
**Can start:** As soon as 1.1–1.6 are all done.

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 2.1 — Build `POST /api/chat` route calling `gemini-3.1-flash-lite` | BE | 1.6 | 1 day | Given `{studentId, message}`, returns a real Gemini reply |
| 2.2 — Write & apply Kidsko system prompt | BE + PM | 2.1 | 0.5 day | 5 test questions return safe, age-appropriate, Socratic answers |
| 2.3 — Create `messages` and `chat_threads` tables | BE | 1.2 | 0.5 day | Tables exist, linked to `students` |
| 2.4 — Persist every message sent/received | BE | 2.1, 2.3 | 0.5 day | Reopening app after closing shows prior messages |
| 2.5 — Connect chat input UI to real `/api/chat` | FE | 2.1 | 1 day | Typing + sending returns a live AI reply, no more hardcoded demo bubble |
| 2.6 — Sidebar shows real threads grouped by date | FE | 2.4 | 1 day | "Today/Yesterday/Previous 7 Days" reflects real DB data |
| 2.7 — New Chat button creates a new thread | FE | 2.6 | 0.5 day | Starting new chat doesn't overwrite the previous one |

**Phase 2 Exit KPI:** ✅ A logged-in student can hold a real conversation with the AI, and it persists after force-closing the app.

---

## 6. Phase 3 & Phase 4 — Run These in Parallel (if team size allows)
**Depends on:** Phase 2 complete.
**Can start:** As soon as 2.1–2.7 are all done. **These two phases do not depend on each other — assign to two different people if possible.**

### Phase 3 — Homework Photo Scanning
| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 3.1 — Integrate `expo-camera` on camera button | FE | Phase 2 | 1 day | Tapping camera opens real device camera view |
| 3.2 — Client-side compression before upload | FE | 3.1 | 0.5 day | Uploaded payload under ~300KB (checked via network inspector) |
| 3.3 — Build `POST /api/analyze-homework` (Sharp + Gemini vision) | BE | Phase 2 | 1.5 days | Real worksheet photo returns genuine step-by-step explanation |
| 3.4 — Render image + explanation as chat bubble pair | FE | 3.1, 3.3 | 1 day | Thumbnail + text appear together in thread |
| 3.5 — Handle bad/blurry images gracefully | BE + FE | 3.3 | 0.5 day | Blurry/blank image returns friendly retry message, no crash |

**Phase 3 Exit KPI:** ✅ A real handwritten homework photo produces a correct, non-answer-giving explanation.

### Phase 4 — Voice Input & Output
| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 4.1 — Integrate speech-to-text on mic button | FE | Phase 2 | 1 day | Speaking converts to text within ~2 seconds |
| 4.2 — Auto-send recognized speech to `/api/chat` | FE | 4.1 | 0.5 day | No manual send tap needed after speaking |
| 4.3 — Integrate text-to-speech for AI replies | FE | Phase 2 | 1 day | Response read aloud, with a mute toggle |

**Phase 4 Exit KPI:** ✅ A child can ask a question entirely by voice and hear the answer read back.

**Both Phase 3 and Phase 4 must be complete before starting Phase 5.**

---

## 7. Phase 5 — Usage Limits, Tier Enforcement & Paywall
**Depends on:** Phase 3 AND Phase 4 complete.
**Can start:** Once both parallel tracks finish.

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 5.1 — Add `daily_message_count`/`daily_scan_count` enforcement server-side | BE | Phase 3, 4 | 1 day | Backend rejects 11th message/4th scan with `429` |
| 5.2 — Sync usage-pill badge to real server counts | FE | 5.1 | 0.5 day | Badge matches DB after every message/scan |
| 5.3 — Add parental gate before Paywall screen | FE | — | 0.5 day | Child cannot reach payment screen without solving the gate |
| 5.4 — Wire Paywall to Stripe Checkout | FE + BE | 5.3 | 1 day | "Upgrade" opens real (test-mode) Stripe flow |
| 5.5 — Build Stripe webhook handler | BE | 5.4 | 1 day | Successful test payment flips `is_premium = true` |
| 5.6 — Build midnight reset job | BE | 5.1 | 0.5 day | Manually triggering resets all counters to 0 |

**Phase 5 Exit KPI:** ✅ You hit the free limit, pass the parental gate, complete a test payment, and immediately send an 11th message successfully.

---

## 8. Phase 6 — Polish, Settings Completion & Safety Pass
**Depends on:** Phase 5 complete.
**Can start:** Once billing/limits loop is fully proven.

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 6.1 — Wire remaining Settings screens to real backend calls | FE + BE | Phase 5 | 1.5 days | Zero mock data remains anywhere in the app |
| 6.2 — Run adversarial AI safety test (10 jailbreak prompts) | PM | Phase 2 (can start earlier, but sign off here) | 0.5 day | AI safely redirects 10/10 times |
| 6.3 — Accessibility pass (44x44pt tap targets, font scaling) | FE | Phase 5 | 0.5 day | All primary buttons meet minimum tap size |
| 6.4 — Real device test (≥1 iOS, ≥1 Android) | PM | 6.1 | 0.5 day | No broken layouts on either device |
| 6.5 — COPPA data-retention audit | PM + BE | Phase 5 | 0.5 day | No raw voice/image files persist beyond processing |

**Phase 6 Exit KPI:** ✅ Zero mock content anywhere; full signup → chat → scan → upgrade → settings flow works without a crash.

---

## 9. Phase 7 — Store Submission & Launch
**Depends on:** Phase 6 complete.
**Can start:** Once the full flow is crash-free and audited.

| Ticket | Owner | Depends On | Time | Definition of Done |
|---|---|---|---|---|
| 7.1 — Switch backend to the billed Gemini key (`.env.production`) | BE | Phase 6 | 0.5 hr | Verified: production traffic uses paid tier, not free tier |
| 7.2 — Configure EAS Build | FE | Phase 6 | 0.5 day | Produces signed iOS `.ipa` and Android `.aab` |
| 7.3 — Prepare store listings, Privacy Policy, Data Safety Form | PM | — | 1–2 days | Listings live with all required disclosures |
| 7.4 — Submit for review (Apple Kids Category + Google Families) | PM | 7.2, 7.3 | 0.5 day (+ review wait) | App is In Review on both stores |
| 7.5 — Recruit 5–10 real test families | PM | 7.4 | ongoing | 5+ real users complete signup + send ≥1 message |
| 7.6 — Collect structured feedback | PM | 7.5 | 0.5 day | 1-page feedback log with real notes |

**Phase 7 Exit KPI:** ✅ App is live (or in TestFlight/Internal Testing), running on the billed Gemini tier, and 5 real families have used it.

---

## 10. Quick Reference: What Can Run Together vs. What Can't

| Can run in parallel | Cannot run in parallel (strict order) |
|---|---|
| Phase 3 (Photo) + Phase 4 (Voice) — different people, no shared dependency | Phase 0 → 1 → 2 (each needs the last) |
| Within any phase: FE tickets and BE tickets often run side-by-side once the API contract (request/response shape) is agreed on first | Phase 5 → 6 → 7 (each needs the last) |
| Ticket 6.2 (safety testing) can start as early as Phase 2, in the background, while other Phase 6 tickets wait | 5.4 (Paywall UI) needs 5.3 (parental gate) done first — sequence within the phase matters |

**One coordination rule for any team size >1:** agree on the **API request/response shape** (e.g., exactly what `/api/chat` accepts and returns) *before* FE and BE start their tickets in parallel — this is the #1 cause of rework when two people build both sides of an API independently.

---

## 11. How to Use This With a Real Team

1. Copy each ticket row into your project tool (Trello/Linear/GitHub Projects) as one card, titled with its ticket number (e.g., "2.1 — Build POST /api/chat").
2. Set the "Depends On" column as a blocking relationship if your tool supports it (Linear and GitHub Projects both do).
3. Assign owners per the Owner column, adjusted for your actual team size (see Section 2).
4. Treat each phase's **Exit KPI** as the phase's "Done" milestone — don't let the next phase's tickets move to "In Progress" until it's checked.
5. Standup question each day: *"What ticket are you on, and is anything blocking you from the Depends On column?"* — this alone catches most delays early.
