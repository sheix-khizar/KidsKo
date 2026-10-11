# Kidsko.ai — Master Plan (v2.0)
**Updated for Gemini 3.1 Flash-Lite** — supersedes prior tech stack/SRS/roadmap/startup docs, which referenced the now-deprecated Gemini 2.5 Flash-Lite (shuts down Oct 16, 2026).

---

## What Changed in This Update

| Item | Old (v1.0) | New (v2.0) |
|---|---|---|
| AI Model | `gemini-2.5-flash-lite` (deprecated, shutting down Oct 16, 2026) | **`gemini-3.1-flash-lite`** (current, GA) |
| Input pricing | $0.075–$0.10 / M tokens | **$0.25 / M tokens** |
| Output pricing | $0.30–$0.40 / M tokens | **$1.50 / M tokens** |
| Heavy premium user cost estimate | ~$0.30–0.50/month | **~$1–2/month** (margin still healthy vs. $9.99/mo) |
| Free tier data policy | Not flagged | **Free tier prompts may be used for Google model training — explicit go-live blocker added below** |
| Free tier limits | Not specified | ~15 RPM, ~1,000–1,500 requests/day (varies by account/region — verify live in AI Studio) |

Everything else from the prior plans (architecture shape, screen specs, phase sequencing, startup strategy) still holds. Only the AI-cost and AI-compliance numbers needed correcting.

---

## PART A — Tech Stack (Updated)

### A.1 Frontend (Mobile App)
| Layer | Choice | Purpose |
|---|---|---|
| Framework | **React Native (Expo SDK 57, Managed Workflow)** | Cross-platform mobile app |
| Language | **TypeScript** | Type safety, fewer runtime bugs |
| Navigation | **React Navigation (Native Stack + Bottom Sheet)** | Screen routing (matches your 11-screen prototype) |
| Styling | **NativeWind** | Rapid styling matching prototype design tokens |
| State Management | **Zustand** or React Context | Chat state, usage counters, auth session, premium status |
| Camera | **expo-camera** | Homework photo capture |
| Image handling | **expo-image-picker** + **expo-image-manipulator** | Gallery fallback + client-side resize |
| Voice input | **expo-speech-recognition** (or `@react-native-voice/voice`) | Speech-to-text for mic button |
| Voice output | **expo-speech** | Text-to-speech for AI answers |
| Secure storage | **expo-secure-store** | Auth token storage |
| Push notifications | **expo-notifications** | Reminders, weekly summary alerts |
| Icons | **lucide-react-native** | Consistent icon set |

### A.2 Backend
| Layer | Choice | Purpose |
|---|---|---|
| Runtime | **Node.js + Express** (or Fastify) | REST API server |
| Language | **TypeScript** | Shared types with frontend |
| Image processing | **Sharp** | Server-side compression before sending to Gemini |
| **AI Engine** | **Google Gemini 3.1 Flash-Lite** (`@google/genai` SDK) | Multimodal chat, homework image analysis, voice-derived text |
| Caching | **Redis** (optional, Phase 2+) | Cache common Q&A to cut duplicate API cost |
| Background jobs | **Supabase Edge Functions** or **node-cron** | Daily usage counter reset at midnight |
| Auth | **Supabase Auth** | Email/password + Google OAuth |
| File storage | **Supabase Storage** | Temporary homework image storage, auto-delete for COPPA |
| Payments | **Stripe** (+ RevenueCat if using App Store/Play IAP) | Subscription billing, webhook tier upgrades |
| Error monitoring | **Sentry** | Crash + exception tracking |
| Hosting | **Railway / Render / Fly.io** or AWS at scale | Backend deployment |

### A.3 Database & Data Layer
| Layer | Choice | Purpose |
|---|---|---|
| Database | **Supabase (PostgreSQL)** | Single source of truth |
| ORM | **Prisma** or Supabase JS client | Type-safe DB access |
| Row-level security | **Supabase RLS policies** | Parents only see their own child's data (COPPA-critical) |

### A.4 Updated AI Cost Model
| Scenario | Tokens | Cost at Gemini 3.1 Flash-Lite pricing |
|---|---|---|
| One 30-message text conversation | ~3,000–5,000 tokens | **$0.005–0.01** |
| One homework photo analysis | ~1,500–2,500 tokens (image + response) | **~$0.003–0.005** |
| Heavy free-tier user (10 msgs + 3 scans/day, 30 days) | ~150,000 tokens/month | **~$0.20–0.30/month** |
| Heavy premium user (2,000 msgs + 500 scans/month cap) | ~1–1.5M tokens/month | **~$1–2/month** |

At $9.99/month premium pricing, this still holds a **~80–90% gross margin** on API cost alone — lower than the original (now-invalid) 95% estimate, but still an excellent SaaS margin.

---

## PART B — System Architecture (Updated)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MOBILE APP (React Native / Expo)                 │
│                                                                        │
│  Screen Layer (matches your 11-screen prototype):                    │
│  Splash → Register/Login → Chat Hub (+ Sidebar) → Settings →         │
│  Profile → Change Password → Chat History → Notifications →          │
│  Dark Mode → Language → Paywall/Subscription                         │
│                                                                        │
│  Local State: Zustand store (session, chat cache, usage counters)    │
└───────────────────────────────┬────────────────────────────────────--┘
                                 │ HTTPS (JWT auth header)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js + Express, TS)                │
│                                                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ Auth         │  │ Chat/AI      │  │ Usage & Tier  │  │ Billing   │ │
│  │ Middleware   │  │ Gateway      │  │ Enforcement   │  │ Webhooks  │ │
│  │ (validates   │  │ (routes text/│  │ (checks daily │  │ (Stripe → │ │
│  │  Supabase JWT)│  │  image/voice │  │  limits before│  │  updates  │ │
│  │              │  │  to Gemini)  │  │  calling AI)  │  │  is_premium)│
│  └─────────────┘  └──────┬───────┘  └───────┬───────┘  └───────────┘ │
│                           │                  │                       │
│                    ┌──────▼───────┐   ┌──────▼────────┐              │
│                    │ Image Compress│   │ Cache Lookup  │              │
│                    │ (Sharp)       │   │ (Redis, opt.) │              │
│                    └──────┬────────┘   └───────────────┘              │
└───────────────────────────┼───────────────────────────────────────--┘
                             │
              ┌──────────────┼───────────────────┐
              ▼              ▼                   ▼
    ┌──────────────┐ ┌──────────────────┐  ┌─────────────────┐
    │ Supabase      │ │ Google Gemini     │  │ Stripe            │
    │ (Postgres +   │ │ 3.1 Flash-Lite    │  │ (Subscriptions,   │
    │  Auth+Storage)│ │ (multimodal, GA)  │  │  webhooks)         │
    └──────────────┘ └──────────────────┘  └─────────────────┘
```

### B.1 Request Flow — "Child scans homework photo" (unchanged logic, updated model)
1. App captures photo → compresses client-side → base64.
2. App calls `POST /api/analyze-homework` with `{studentId, imageBase64}` + JWT.
3. Backend validates JWT → checks `daily_scan_count < scan_limit`.
4. If over limit and not premium → `429` → app navigates to Paywall (behind parental gate).
5. If allowed → Sharp compresses further → sends to **Gemini 3.1 Flash-Lite** with system prompt → Socratic explanation returned.
6. Backend increments `daily_scan_count`, logs message, returns response.
7. App renders reply as chat bubble; updates usage-pill badge.

### B.2 Critical New Architecture Rule: Billing Must Be On Before Real Users
```
[ Dev/Test Environment ] → Gemini 3.1 Flash-Lite FREE TIER
       (Google may use prompts to train models — acceptable for
        synthetic/test data only, NEVER for real child conversations)

[ Production Environment ] → Gemini 3.1 Flash-Lite PAID TIER (billing enabled)
       (Google contractually does not train on this data —
        this is a hard go-live requirement, not optional)
```
**Build this as an environment-config switch from day one** (`.env.development` uses free-tier key, `.env.production` uses billed key) so there is no chance of accidentally routing real user data through the free tier.

---

## PART C — Requirements (Updated)

### C.1 Functional Requirements
| ID | Requirement |
|---|---|
| FR-1 | Parent can register/login via email or Google OAuth |
| FR-2 | Parent can create one or more student sub-profiles |
| FR-3 | Student can send a text chat message and receive an AI response within 3 seconds (p95), via Gemini 3.1 Flash-Lite |
| FR-4 | Student can capture/upload a homework photo and receive a step-by-step (non-answer-giving) explanation |
| FR-5 | Student can use voice input (speech-to-text) to ask a question hands-free |
| FR-6 | AI responses are read aloud via text-to-speech (optional, toggleable) |
| FR-7 | Free-tier users are capped at a defined daily message/image limit; exceeding it routes to the Paywall (behind a parental gate) |
| FR-8 | Premium users bypass daily limits (soft server-side cap still applies) |
| FR-9 | Parent can upgrade to Premium via Stripe directly from the Paywall screen |
| FR-10 | Chat history is persisted per student and browsable in the sidebar |
| FR-11 | User can start a New Chat without deleting history |
| FR-12 | Settings allow profile edit, password change, notification toggles, dark mode, language |
| FR-13 | Usage badge shows remaining free credits or "Premium" status in real time |
| **FR-14 (new)** | **Backend environment configuration must route all production traffic to the paid (billed) Gemini tier — never the free tier — for any real user** |

### C.2 Non-Functional Requirements
| ID | Requirement |
|---|---|
| NFR-1 | 99.5%+ uptime for backend API (MVP target) |
| NFR-2 | AI text response < 3s (p95), image analysis < 6s (p95) |
| NFR-3 | All AI calls use `max_output_tokens: 250`, `temperature: 0.2–0.3` |
| NFR-4 | No child voice recordings or raw face images stored beyond the processing request (COPPA) |
| NFR-5 | All API traffic over HTTPS/TLS 1.2+ |
| NFR-6 | Passwords hashed via Supabase Auth |
| NFR-7 | App functions on iOS 15+ and Android 10+ |
| NFR-8 | Backend rejects any request without a valid JWT |
| NFR-9 | Daily usage counters reset automatically at midnight |
| **NFR-10 (new)** | **Gemini API billing must be enabled (paid tier) before any real user's data is processed — verified as a Phase 7 launch blocker, not a Phase 0 nice-to-have** |

### C.3 Legal / Compliance Requirements
| ID | Requirement |
|---|---|
| LR-1 | COPPA-compliant data handling — verifiable parental consent at signup |
| LR-2 | Clear, plain-language Privacy Policy and Terms of Service |
| LR-3 | No behavioral advertising or ad SDKs targeting child users |
| LR-4 | Data deletion request flow available to parents |
| LR-5 | Stripe/payment data never touches your own servers (PCI compliance via Stripe) |
| LR-6 | Parental gate required before Settings, Paywall/payment screens, and any external links (Apple Kids Category requirement) |
| **LR-7 (new)** | **Gemini API must run on the paid tier for all production traffic — the free tier's "may be used for training" clause is incompatible with children's data under COPPA** |

---

## PART D — KPI Development Roadmap (Updated)

Each phase has an **Entry Gate** and a single yes/no **Exit KPI**. Work sequentially.

### Phase 0 — Environment & Infrastructure Setup
**Time:** 2–3 days
| Task | KPI |
|---|---|
| Initialize Expo TypeScript project (SDK 57) | `npx expo start` runs, shows app on a real device via Expo Go |
| Initialize Node.js/Express TS backend | `GET /health` returns `200 OK` |
| Create Supabase project | Dashboard shows empty project, Auth enabled |
| Create **two** Gemini API keys | One free-tier key (`.env.development`), one billed key (`.env.production`) — both tested with a `curl` request |
| Create Stripe test account | Test Mode active, one $9.99/mo test product created |
| Set up Git repo + branch strategy | Repo exists, `.env.example` committed (no real secrets) |

**Exit KPI:** ✅ Expo app runs on your phone AND hits the local backend's `/health` endpoint, AND you can show two distinct Gemini keys exist (dev/free vs. prod/billed).

---

### Phase 1 — Authentication & Data Model
**Time:** 3–5 days
| Task | KPI |
|---|---|
| Create `profiles`, `students` tables | Visible in Supabase Table Editor |
| Wire Register/Login to Supabase Auth | Signup creates `auth.users` + `profiles` rows; login stores JWT via `expo-secure-store` |
| Add student sub-profile creation | Row appears in `students` table |
| Add backend JWT-verification middleware | Unauthenticated calls return `401` |

**Exit KPI:** ✅ A real person can register, create a student profile, log out, log back in, and land on chat already authenticated.

---

### Phase 2 — Core Text Chat (Gemini 3.1 Flash-Lite Integration)
**Time:** 5–7 days
| Task | KPI |
|---|---|
| Build `POST /api/chat` using **`gemini-3.1-flash-lite`** | Given `{studentId, message}`, returns a real AI reply |
| Apply Kidsko system prompt | 5 sample questions return safe, age-appropriate, Socratic answers |
| Persist messages in `messages`/`chat_threads` tables | Reopening app shows prior messages |
| Connect chat input UI to real endpoint | Replaces hardcoded demo bubble with live AI reply |
| Sidebar shows real threads by date | Reflects actual DB data, not mock entries |

**Exit KPI:** ✅ A logged-in student can hold a real conversation via Gemini 3.1 Flash-Lite (using the free-tier dev key), and it persists after force-closing the app.

---

### Phase 3 — Homework Photo Scanning
**Time:** 4–6 days
| Task | KPI |
|---|---|
| Integrate `expo-camera` | Tapping camera opens real device camera view |
| Client-side compression before upload | Payload under ~300KB for a typical photo |
| Build `POST /api/analyze-homework` (Sharp + Gemini 3.1 Flash-Lite vision) | Real worksheet photo returns genuine step-by-step explanation |
| Render image + explanation as chat bubble pair | Thumbnail + text appear together in thread |
| Handle bad/blurry images gracefully | Friendly retry message, no crash |

**Exit KPI:** ✅ A real handwritten homework photo produces a correct, non-answer-giving explanation via Gemini 3.1 Flash-Lite.

---

### Phase 4 — Voice Input & Output
**Time:** 2–3 days
| Task | KPI |
|---|---|
| Speech-to-text on mic button | Speaking converts to text within ~2 seconds |
| Auto-send recognized speech to `/api/chat` | No manual send tap needed |
| Text-to-speech for AI replies | Response read aloud, with mute toggle |

**Exit KPI:** ✅ A child can ask a question entirely by voice and hear the answer read back.

---

### Phase 5 — Usage Limits, Tier Enforcement & Paywall
**Time:** 4–5 days
| Task | KPI |
|---|---|
| Enforce `daily_message_count`/`daily_scan_count` server-side | Backend rejects the 11th message/4th scan with `429` |
| Sync usage-pill badge to real server counts | Badge matches DB after every action |
| **Add parental gate before Paywall screen** (Apple Kids Category requirement) | Child cannot reach payment screen without solving gate |
| Wire Paywall to Stripe Checkout | "Upgrade" opens real (test-mode) Stripe flow |
| Build Stripe webhook handler | Successful test payment flips `is_premium = true` |
| Build midnight reset job | Manually triggering resets all counters to 0 |

**Exit KPI:** ✅ You hit the free limit, pass the parental gate, complete a test payment, and immediately send an 11th message successfully.

---

### Phase 6 — Polish, Settings Completion & Safety Pass
**Time:** 3–5 days
| Task | KPI |
|---|---|
| Wire remaining Settings screens to real backend calls | Zero mock data remains |
| Adversarial AI safety test (10 jailbreak prompts) | AI safely redirects 10/10 times |
| Accessibility pass | 44x44pt tap targets, font scaling tested |
| Real device test (≥1 iOS, ≥1 Android) | No broken layouts |
| COPPA data-retention audit | No raw voice/image files persist beyond processing |

**Exit KPI:** ✅ Zero mock content anywhere; full signup → chat → scan → upgrade → settings flow works without a crash.

---

### Phase 7 — Store Submission & Launch
**Time:** 3–7 days (includes review wait time)
| Task | KPI |
|---|---|
| **Switch backend to the billed Gemini key (`.env.production`)** | Verified: production traffic uses the paid tier, not free tier |
| Configure EAS Build | Produces signed iOS `.ipa` and Android `.aab` |
| Prepare store listings, Privacy Policy, Data Safety Form | Listings live with all required disclosures |
| Submit for review (Apple Kids Category + Google Families) | App is In Review |
| Recruit 5–10 real test families | 5+ real users complete signup + send ≥1 message |
| Collect structured feedback | 1-page feedback log |

**Exit KPI:** ✅ App is live (or in TestFlight/Internal Testing), running on the **billed** Gemini tier, and 5 real families have used it.

---

## PART E — Startup Plan (Updated Cost & Compliance Points)

*(Full validation, GTM, funding, and KPI sections carry over unchanged from the prior startup plan — only the AI-cost and compliance figures below are updated.)*

### E.1 Updated Unit Economics
| Metric | Updated Figure |
|---|---|
| AI cost per free user/month | ~$0.20–0.30 |
| AI cost per heavy premium user/month | ~$1–2 |
| Gross margin at $9.99/mo | **~80–90%** (down from originally estimated 95%, still excellent) |
| Break-even point | Still reachable with your first 5–10 paying customers |

### E.2 Updated Risk Register Entry
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Real user data accidentally processed on Gemini's free tier** | Low if you follow Phase 0/7 controls | **High** — direct COPPA violation exposure (free tier allows training on prompts) | Separate dev/prod API keys from Phase 0; hard-block in code that checks environment before every Gemini call; Phase 7 exit KPI explicitly verifies billed key is active |
| Gemini pricing changes again | Medium | Medium | Keep `/api/chat` provider-agnostic in code structure so swapping models/providers is a config change, not a rewrite |

### E.3 Updated Compliance Checklist Addition
| Item | Status Needed |
|---|---|
| Gemini API billing enabled before any real user interacts with the app | ✅ **Hard launch blocker** — check this explicitly at Phase 7, not assumed from Phase 0 |
| Free-tier key never present in production environment variables | ✅ Verify via deployment config review before submission |

---

## Bottom Line

The plan's shape hasn't changed — same architecture, same phases, same startup strategy. What changed is the specific model name, the real cost numbers (still very healthy margins), and one new hard rule: **the free tier is for your own testing only, and billing must be flipped on before a single real child uses the app.** That's now baked into Phase 0 (create both keys) and Phase 7 (verify the switch) as explicit, checkable steps — not something to remember informally.
