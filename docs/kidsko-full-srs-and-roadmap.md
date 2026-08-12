# Kidsko.ai — Complete Technical Blueprint
**Software Requirements Specification, Architecture, Tech Stack & KPI Development Roadmap**

Version 1.0 | Based on the approved 11-screen prototype (auth, chat, sidebar history, settings, subscription/paywall, usage limits)

---

## 0. Quick Answer: Is React Native + Expo the Right Choice?

**Yes.** For Kidsko.ai specifically, it's the right call, for these reasons:

| Requirement | Why React Native + Expo fits |
|---|---|
| Kids use phones/tablets, not desktops | RN gives you real native camera + mic access — a web app can't match this reliably on iOS |
| One team, one codebase | Same JS/TS codebase ships to iOS + Android; you don't need two native teams |
| Fast iteration with AI coding agents | Expo is the most "AI-agent-friendly" mobile framework — Cursor/Windsurf/Claude Code all generate clean Expo code |
| You need camera, mic, push notifications, in-app purchase | Expo has first-party modules for all of these (`expo-camera`, `expo-speech`, `expo-notifications`, `expo-in-app-purchases` or RevenueCat) |
| Small team / solo builder | Expo's managed workflow means no need to touch Xcode/Android Studio config for MVP |

**The one caveat:** if you ever need something *very* custom at the native layer (e.g. deep OS-level integrations), you'd eject from the "managed" workflow into "bare" Expo. For Kidsko.ai's feature set (chat, camera, voice, subscriptions), you will **not** need to eject. Stay managed.

---

## 1. Complete Tech Stack

### 1.1 Frontend (Mobile App)
| Layer | Choice | Purpose |
|---|---|---|
| Framework | **React Native (Expo, Managed Workflow)** | Cross-platform mobile app |
| Language | **TypeScript** | Type safety, fewer runtime bugs, better AI-agent code generation |
| Navigation | **React Navigation (Native Stack + Bottom Sheet for modals)** | Screen routing (matches your 11-screen prototype states) |
| Styling | **NativeWind** (Tailwind for RN) | Rapid, consistent styling matching your prototype's design tokens |
| State Management | **Zustand** (lightweight) or React Context | Manages chat state, usage counters, auth session, premium status |
| Camera | **expo-camera** | Homework photo capture |
| Image handling | **expo-image-picker** + **expo-image-manipulator** | Gallery fallback + client-side resize before upload |
| Voice input | **expo-speech-recognition** (or `@react-native-voice/voice`) | Speech-to-text for mic button |
| Voice output | **expo-speech** | Text-to-speech for reading AI answers aloud |
| Local/session storage | **expo-secure-store** (tokens) + in-memory state (usage counters synced from server) | Secure auth token storage |
| Push notifications | **expo-notifications** | Daily reminders, weekly parent summary alerts |
| Icons | **lucide-react-native** | Consistent icon set |

### 1.2 Backend
| Layer | Choice | Purpose |
|---|---|---|
| Runtime | **Node.js + Express** (or **Fastify** for slightly better perf) | REST API server |
| Language | **TypeScript** | Shared types with frontend, safer contracts |
| Image processing | **Sharp** | Server-side compression (1024px/75% JPEG) before sending to Gemini |
| AI Engine | **Google Gemini 2.5 Flash-Lite** (`@google/genai` SDK) | Multimodal chat, homework image analysis, voice-text responses |
| Caching | **Redis** (optional, Phase 2+) | Cache common Q&A, reduce duplicate API cost |
| Background jobs | **Supabase Edge Functions** or **node-cron** | Daily usage counter reset at midnight |
| Auth | **Supabase Auth** | Email/password + Google OAuth, session/JWT issuance |
| File storage | **Supabase Storage** | Temporary homework image storage (auto-delete policy for COPPA) |
| Payments | **Stripe** (+ **RevenueCat** if going through App Store/Play Store IAP) | Subscription billing, webhook-driven tier upgrades |
| Error monitoring | **Sentry** | Crash + exception tracking |
| Hosting | **Railway / Render / Fly.io** (simple, cheap) or **AWS (Elastic Beanstalk / Lambda)** for scale | Backend deployment |

### 1.3 Database & Data Layer
| Layer | Choice | Purpose |
|---|---|---|
| Database | **Supabase (PostgreSQL)** | Single source of truth: users, students, chats, usage, subscriptions |
| ORM | **Prisma** or **Supabase JS client** directly | Type-safe DB access from Node backend |
| Row-level security | **Supabase RLS policies** | Ensures a parent can only see their own child's data — critical for COPPA |

### 1.4 Third-Party Services
| Service | Purpose |
|---|---|
| **Google Gemini API** | Core AI engine (text, vision, cheap multimodal) |
| **Stripe** | Subscription billing + webhooks |
| **Supabase** | Auth, DB, Storage, Edge Functions — all in one |
| **Sentry** | Error monitoring |
| **Expo EAS (Build & Submit)** | Cloud build pipeline → App Store / Play Store submission without owning a Mac |
| **Resend / Postmark** (optional) | Transactional email — weekly parent progress email |

### 1.5 Full Stack Diagram (One Line Summary)
```
React Native (Expo/TS) → Node.js/Express API → Supabase (Auth+DB+Storage) → Gemini API
                                             ↘ Stripe (billing)
                                             ↘ Sentry (monitoring)
```

---

## 2. Complete System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MOBILE APP (React Native / Expo)                 │
│                                                                        │
│  Screen Layer (matches your prototype's 11 states):                  │
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
    ┌──────────────┐ ┌───────────────┐  ┌─────────────────┐
    │ Supabase      │ │ Google Gemini │  │ Stripe            │
    │ (Postgres +   │ │ 2.5 Flash-Lite│  │ (Subscriptions,   │
    │  Auth+Storage)│ │ (multimodal)  │  │  webhooks)         │
    └──────────────┘ └───────────────┘  └─────────────────┘
```

### 2.1 Request Flow Example — "Child scans homework photo"
1. App captures photo → compresses client-side (`expo-image-manipulator`) → base64.
2. App calls `POST /api/analyze-homework` with `{studentId, imageBase64}` + JWT.
3. Backend validates JWT → looks up `students` row → checks `daily_scan_count < scan_limit`.
4. If over limit and not premium → returns `429` → app navigates to Paywall screen (as already built in your prototype).
5. If allowed → Sharp compresses further server-side → sends to Gemini with system prompt → gets Socratic explanation.
6. Backend increments `daily_scan_count`, logs the message in `messages` table, returns response.
7. App renders AI reply as a chat bubble; updates the usage-pill badge in the top bar.

---

## 3. Requirements

### 3.1 Functional Requirements
| ID | Requirement |
|---|---|
| FR-1 | User (parent) can register/login via email or Google OAuth |
| FR-2 | Parent can create one or more student sub-profiles |
| FR-3 | Student can send a text chat message and receive an AI response within 3 seconds (p95) |
| FR-4 | Student can capture/upload a homework photo and receive a step-by-step (non-answer-giving) explanation |
| FR-5 | Student can use voice input (speech-to-text) to ask a question hands-free |
| FR-6 | AI responses are read aloud via text-to-speech (optional, toggleable) |
| FR-7 | Free-tier users are capped at a defined daily message/image limit; exceeding it routes to the Paywall screen |
| FR-8 | Premium users bypass daily limits (soft server-side cap still applies to prevent abuse) |
| FR-9 | Parent can upgrade to Premium via Stripe (or App Store/Play Store IAP) directly from the Paywall screen |
| FR-10 | Chat history is persisted per student and browsable in the sidebar ("Today / Yesterday / Previous 7 Days") |
| FR-11 | User can start a New Chat, clearing the active thread without deleting history |
| FR-12 | Settings allow profile edit, password change, notification toggles, dark mode, language selection |
| FR-13 | Usage badge in the chat top bar shows remaining free credits or "Premium" status in real time |

### 3.2 Non-Functional Requirements
| ID | Requirement |
|---|---|
| NFR-1 | 99.5%+ uptime for the backend API (MVP target; 99.9% at scale) |
| NFR-2 | AI text response returned in under 3 seconds (p95), image analysis under 6 seconds (p95) |
| NFR-3 | All AI calls use `max_output_tokens: 250`, `temperature: 0.2–0.3` to control cost and tone |
| NFR-4 | No child voice recordings or raw face images are stored beyond the processing request (COPPA) |
| NFR-5 | All API traffic over HTTPS/TLS 1.2+ |
| NFR-6 | Passwords hashed via Supabase Auth (bcrypt under the hood) — never stored in plaintext |
| NFR-7 | App must function on iOS 15+ and Android 10+ |
| NFR-8 | Backend must reject any request without a valid JWT (except `/register`, `/login`) |
| NFR-9 | Daily usage counters reset automatically at midnight UTC (or user's local timezone, v2) |

### 3.3 Legal / Compliance Requirements
| ID | Requirement |
|---|---|
| LR-1 | COPPA-compliant data handling — verifiable parental consent at signup |
| LR-2 | Clear, published Privacy Policy and Terms of Service, written in plain language |
| LR-3 | No behavioral advertising or ad SDKs targeting child users |
| LR-4 | Data deletion request flow — parent can request full account/data deletion |
| LR-5 | Stripe/payment data never touches your own servers directly (PCI compliance handled by Stripe) |

---

## 4. Full Software Requirements Specification (SRS)

### 4.1 Introduction
- **Purpose:** Define the complete functional and technical scope of Kidsko.ai v1.0, an AI-powered homework-helper mobile app for children aged 5–12, with parent-managed subscriptions.
- **Scope:** Native iOS/Android app (React Native/Expo) + Node.js backend + Supabase + Gemini AI + Stripe billing.
- **Intended Audience:** Solo founder / small dev team, future contractors, AI coding agents (Cursor, Windsurf, Claude Code).
- **Definitions:**
  - *Parent* = account owner, economic buyer, billing contact.
  - *Student* = child sub-profile under a parent account, primary app user.
  - *Free tier* = default access level with daily usage caps.
  - *Premium tier* = paid subscription ($9.99/mo) with expanded (not infinite) usage caps.

### 4.2 Overall Description
- **Product Perspective:** Standalone consumer mobile app; not part of a larger system.
- **Product Functions:** Chat-based AI tutoring, homework photo scanning, voice interaction, usage-gated freemium model, account/settings management.
- **User Classes:**
  1. **Child/Student** — primary interactive user, low reading ability, needs large visual UI.
  2. **Parent** — account owner, manages billing/subscription, indirect app usage (currently no separate dashboard per your "keep it simple" decision — parent uses the same Settings screen as an adult would).
- **Operating Environment:** iOS 15+, Android 10+, backend hosted on a cloud provider (Render/Railway/AWS).
- **Constraints:** Must operate profitably at $9.99/mo with ~$0.30–0.50/user/month AI cost; must remain COPPA-compliant; small-team-maintainable codebase (avoid over-engineering for MVP).
- **Assumptions:** Users have a stable internet connection; Gemini API and Stripe remain available and priced similarly to current rates.

### 4.3 System Features (Detailed)

**4.3.1 Authentication**
- Description: Email/password and Google OAuth registration and login via Supabase Auth.
- Inputs: email, password (or Google token).
- Outputs: JWT session token, user profile record.
- Priority: Critical (Phase 1)

**4.3.2 AI Chat (Text)**
- Description: Student sends free-text question; backend forwards to Gemini with system prompt; returns Socratic, age-appropriate response.
- Inputs: `{studentId, message}`
- Outputs: `{reply, remainingCredits}`
- Priority: Critical (Phase 2)

**4.3.3 Homework Image Analysis**
- Description: Student uploads/captures a photo; backend compresses and sends to Gemini multimodal endpoint; returns step-by-step guided explanation.
- Inputs: `{studentId, imageBase64}`
- Outputs: `{explanation, remainingCredits}`
- Priority: Critical (Phase 3)

**4.3.4 Voice Input/Output**
- Description: Speech-to-text converts spoken question to text before sending to chat endpoint; text-to-speech reads AI response aloud.
- Priority: High (Phase 4)

**4.3.5 Usage Limits & Tier Enforcement**
- Description: Every AI-calling endpoint checks `is_premium` and daily counters before processing; blocks and redirects to Paywall if exceeded.
- Priority: Critical (Phase 5) — *this is the piece we just added to your prototype UI*

**4.3.6 Subscription & Billing**
- Description: Paywall screen triggers Stripe Checkout (or native IAP); successful payment webhook flips `is_premium = true` on the parent's profile.
- Priority: High (Phase 5)

**4.3.7 Settings & Account Management**
- Description: Profile editing, password change, notification preferences, dark mode, language — all present in your prototype already.
- Priority: Medium (Phase 6)

### 4.4 External Interface Requirements
- **User Interfaces:** Matches the 11-screen prototype (splash, register, login, chat+sidebar, settings, profile, password, history, notifications, dark mode, language) plus the newly added Paywall/Subscription screen.
- **Hardware Interfaces:** Device camera, microphone, speaker.
- **Software Interfaces:** Gemini API, Supabase API, Stripe API, Expo Push Notification service.
- **Communication Interfaces:** REST over HTTPS, JSON payloads, JWT bearer auth.

### 4.5 Data Model (Core Tables)
```sql
-- Parent account
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  is_premium BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Child sub-profile
students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  avatar_asset_name TEXT DEFAULT 'default_mascot',
  daily_message_count INT DEFAULT 0,
  daily_scan_count INT DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text','image')) DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat threads (for sidebar grouping)
chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.6 Non-Functional Requirements
See Section 3.2 above (incorporated by reference into this SRS).

### 4.7 Other Requirements
- **Localization:** UI text externalized into a strings file from day one (your prototype already has a Language screen — build for it now, don't retrofit later).
- **Accessibility:** Minimum tap target size 44x44pt; text scalable for larger accessibility font settings.
- **Analytics (lightweight):** Track feature usage (messages sent, scans used, upgrade conversions) via a simple events table — no third-party tracking SDKs (COPPA risk).

---

## 5. KPI-Based Development Roadmap (Sequential, Dividable, Maintainable)

**Rule for using this roadmap:** Each phase has a hard **Entry Gate** (what must be true before starting) and an **Exit KPI** (a single yes/no test proving the phase is done). Do not skip ahead — each phase depends on the one before it.

---

### Phase 0 — Environment & Infrastructure Setup
**Entry Gate:** None (starting point)
**Owner:** Solo Dev / Backend Lead
**Time:** 2–3 days

| Task | KPI |
|---|---|
| Initialize Expo TypeScript project | `npx expo start` runs, shows default app on a real device via Expo Go |
| Initialize Node.js/Express TS backend | `npm run dev` starts server, `GET /health` returns `200 OK` |
| Create Supabase project | Supabase dashboard shows an empty project with Auth enabled |
| Create Gemini API key | A test `curl` request to Gemini returns valid text |
| Create Stripe test account | Stripe dashboard in Test Mode, one test product created ($9.99/mo) |
| Set up Git repo + branch strategy | Repo exists with `main` + `dev` branches, `.env.example` committed (not real secrets) |

**Exit KPI:** ✅ You can run the Expo app on your phone AND hit your local backend's `/health` endpoint from that same phone.

---

### Phase 1 — Authentication & Data Model
**Entry Gate:** Phase 0 complete
**Owner:** Backend Dev
**Time:** 3–5 days

| Task | KPI |
|---|---|
| Create `profiles`, `students` tables (SQL above) | Tables visible in Supabase Table Editor with correct columns |
| Wire Register screen to Supabase Auth | New user signup creates both an `auth.users` row and a `profiles` row |
| Wire Login screen | Returning user logs in, JWT is stored via `expo-secure-store` |
| Add student sub-profile creation | Parent can add ≥1 student; row appears in `students` table |
| Add backend JWT-verification middleware | Any API call without a valid token returns `401` |

**Exit KPI:** ✅ A real person can register, create a student profile, log out, log back in, and land back on the chat screen already authenticated.

---

### Phase 2 — Core Text Chat (AI Integration)
**Entry Gate:** Phase 1 complete
**Owner:** Backend Dev + Frontend Dev
**Time:** 5–7 days

| Task | KPI |
|---|---|
| Build `POST /api/chat` endpoint | Given `{studentId, message}`, returns a real Gemini-generated reply |
| Apply Kidsko system prompt | 5 manually-tested sample questions return safe, age-appropriate, Socratic-style answers |
| Create `messages` and `chat_threads` tables, persist every message | Reloading the app after closing shows prior messages, not empty state |
| Connect chat input UI to real endpoint | Typing + sending in the prototype UI returns a live AI reply, replacing the hardcoded demo bubble |
| Sidebar shows real threads grouped by date | "Today / Yesterday / Previous 7 Days" reflects actual `chat_threads` data, not mock entries |
| New Chat button creates a new `chat_threads` row | Starting a new chat doesn't overwrite the previous one |

**Exit KPI:** ✅ A logged-in student can hold a real back-and-forth conversation with the AI, and it's still there after force-closing and reopening the app.

---

### Phase 3 — Homework Photo Scanning
**Entry Gate:** Phase 2 complete
**Owner:** Backend Dev (image pipeline) + Frontend Dev
**Time:** 4–6 days

| Task | KPI |
|---|---|
| Integrate `expo-camera` on the camera button | Tapping camera opens a real device camera view (not file picker only) |
| Client-side compression before upload | Confirmed via network inspector: uploaded payload is under ~300KB for a typical photo |
| Build `POST /api/analyze-homework` with Sharp + Gemini vision | Given a real worksheet photo, returns a genuine step-by-step explanation |
| Render image + AI explanation as a chat bubble pair | Photo thumbnail appears above the AI's text response in the thread |
| Handle bad/blurry images gracefully | Sending a blank/blurry image returns a friendly retry message, not a crash |

**Exit KPI:** ✅ A real handwritten homework photo, taken with a real phone camera, produces a correct, helpful, non-answer-giving explanation in the chat.

---

### Phase 4 — Voice Input & Output
**Entry Gate:** Phase 2 complete (can run in parallel with Phase 3 if you have 2 people)
**Owner:** Frontend Dev
**Time:** 2–3 days

| Task | KPI |
|---|---|
| Integrate speech-to-text on mic button | Speaking a question converts to text in the input field within ~2 seconds |
| Auto-send recognized speech to `/api/chat` | No manual "send" tap needed after speaking |
| Integrate text-to-speech for AI replies | AI's response is read aloud automatically (with a mute toggle) |

**Exit KPI:** ✅ A child can ask a question entirely by voice — no typing — and hear the answer read back.

---

### Phase 5 — Usage Limits, Tier Enforcement & Paywall (Monetization)
**Entry Gate:** Phases 2 and 3 complete
**Owner:** Backend Dev + Frontend Dev
**Time:** 4–5 days
*(This phase turns the Paywall/usage-badge UI already added to your prototype into a fully working system.)*

| Task | KPI |
|---|---|
| Add `daily_message_count`, `daily_scan_count`, `last_reset_at` enforcement server-side | Backend, not just the app, rejects the 11th message/4th scan of the day with `429` |
| Sync usage-pill badge in app to real server counts | Badge accurately reflects remaining credits after every message/scan, confirmed against DB |
| Wire Paywall screen to Stripe Checkout | Tapping "Upgrade" opens a real (test-mode) Stripe payment flow |
| Build Stripe webhook handler | Successful test payment flips `is_premium = true` in `profiles` table within seconds |
| Build midnight reset job | Manually triggering the job resets all students' daily counters to 0 |
| Settings subscription card reflects live status | Free vs Premium badge in Settings matches the DB's `is_premium` value in real time |

**Exit KPI:** ✅ You can personally hit the free limit, get routed to the Paywall, complete a test payment, and immediately send an 11th message successfully — full loop proven end-to-end.

---

### Phase 6 — Polish, Settings Completion & Safety Pass
**Entry Gate:** Phases 1–5 complete
**Owner:** Full team / QA
**Time:** 3–5 days

| Task | KPI |
|---|---|
| Wire remaining Settings screens (profile edit, password change, notifications, dark mode, language) to real backend calls | Every toggle/save action persists and reloads correctly — zero remaining mock data anywhere in the app |
| Adversarial AI safety test | 10 "jailbreak" prompts tested manually — AI safely redirects 10/10 times |
| Accessibility pass | All primary buttons meet 44x44pt tap target minimum; font scaling tested |
| Real device test matrix | Tested on ≥1 iOS device and ≥1 Android device, no broken layouts |
| COPPA data-retention check | Confirm no raw voice/image files persist beyond processing (DB/storage audit) |

**Exit KPI:** ✅ Zero hardcoded/mock content remains anywhere in the app, and a fresh install → signup → chat → scan → upgrade → settings-edit flow works start to finish without a single crash.

---

### Phase 7 — Store Submission & Launch
**Entry Gate:** Phase 6 complete
**Owner:** You
**Time:** 3–7 days (includes store review wait time)

| Task | KPI |
|---|---|
| Configure EAS Build | `eas build` produces a signed iOS `.ipa` and Android `.aab` |
| Prepare store listings | App Store + Play Store listings live with screenshots, description, privacy policy link |
| Submit for review | App is In Review on both stores |
| Recruit 5–10 real test families | 5+ real users (not you) complete signup + send ≥1 message |
| Collect structured feedback | 1-page feedback log with notes from real testers |

**Exit KPI:** ✅ App is live on at least one store (or in TestFlight/Internal Testing) and 5 real families have used it.

---

## 6. Summary Timeline & Team Division

| Phase | Focus | Time | Can Run in Parallel With |
|---|---|---|---|
| 0 | Infra setup | 2–3 days | — |
| 1 | Auth & data model | 3–5 days | — |
| 2 | Text chat (AI) | 5–7 days | — |
| 3 | Homework photo scan | 4–6 days | Phase 4 |
| 4 | Voice in/out | 2–3 days | Phase 3 |
| 5 | Usage limits & paywall | 4–5 days | — |
| 6 | Polish & safety | 3–5 days | — |
| 7 | Store submission | 3–7 days | — |
| **Total** | | **~4–6 weeks** (solo or 2-person team) | |

### Suggested Role Split (if you bring on help)
- **Backend Dev:** Phases 0, 1, 2 (API), 3 (image pipeline), 5 (limits/billing logic)
- **Frontend Dev:** Phases 2 (chat UI wiring), 3 (camera UI), 4 (voice), 5 (Paywall UI), 6 (settings wiring)
- **You (Product/QA/Founder):** Phase 6 (safety testing), Phase 7 (store submission, recruiting testers), ongoing prompt/system-instruction tuning

Each phase's task table can be copy-pasted straight into GitHub Projects, Trello, or Linear as one card per row — this keeps the plan literally as manageable as it looks on paper.
