# Kidsko.ai — Master Plan (v3.0)
**Updated for: RevenueCat billing (Pakistan/Stripe fix) + security audit findings + token optimization gaps**
Supersedes Master Plan v2.0. Only the sections below changed — architecture shape, screen specs, and startup strategy carry over unchanged from v2.

---

## What Changed Since v2.0

| Item | v2.0 | v3.0 |
|---|---|---|
| Billing/payments | Stripe (+ RevenueCat optional for IAP) | **RevenueCat + native Apple/Google IAP is now the PRIMARY and only billing method** — Stripe dropped entirely (not available to Pakistan-registered businesses) |
| API abuse protection | Not specified | **New requirement: `express-rate-limit` + `helmet` on all backend routes**, added as a Phase 0/1 ticket, not deferred |
| Per-user AI request throttling | Not specified | **New requirement: rate limit on `/api/chat` and `/api/analyze-homework` per logged-in user** (separate from the daily free-tier cap) — protects against one user exhausting Google's project-wide RPM quota |
| Chat history handling | Not specified | **New requirement: trim to last ~10 messages before sending to Gemini**, don't resend full thread every time |
| Response caching | Optional, "Phase 2+, nice-to-have" | **Now required in Phase 5** — even a simple hardcoded FAQ cache for common questions |
| Usage monitoring | Aggregate spend only | **Expanded to include DAU/MAU and cost-per-feature**, not just total $ burn |
| RLS / backend auth context | Not specified | **Fixed a real bug found during audit:** backend must forward the user's session to Supabase for inserts to satisfy Row Level Security, not just use the anon key with no session context |
| Account deletion | Implied by COPPA (LR-4) but no ticket existed | **Now an explicit Phase 6 ticket**, not just a policy line |

---

## PART A — Tech Stack (Updated: Billing Section Only)

### A.4 Payments — Replaces Stripe Entirely
| Layer | Choice | Purpose |
|---|---|---|
| **Billing** | **RevenueCat** (unifies Apple + Google native in-app purchases) | Subscription management, webhook-driven tier upgrades |
| **Actual payment collection** | **Apple App Store / Google Play native purchase sheets** | Apple/Google collect payment directly — no third-party processor needed, sidesteps Stripe's Pakistan restriction entirely |

**Why this replaced Stripe:** Stripe does not support Pakistan-registered businesses (structural — SBP FX regulations). Since Kidsko is a mobile subscription app, native IAP was always the more natural fit anyway, and it's the billing method Apple prefers (and often requires) for apps in the Kids Category. Google Play Console confirmed supports Pakistan for merchant payouts; Apple Developer Program is accessible but may require an internationally-enabled card for the $99/year fee.

**New request/response flow:**
```
User taps "Upgrade" (behind parental gate)
         |
         v
RevenueCat SDK triggers native purchase sheet (Apple Pay / Google Pay or card)
         |
         v
Apple/Google handles payment -- never touches your backend or a processor directly
         |
         v
RevenueCat webhook -> your backend
         |
         v
Backend flips is_premium = true in Supabase profiles table
```

### A.5 New: Backend Hardening Layer
| Layer | Choice | Purpose |
|---|---|---|
| API abuse protection | `express-rate-limit` | Throttles requests per IP on sensitive endpoints (auth, chat, image analysis) |
| Security headers | `helmet` | Standard header hardening (X-Frame-Options, CSP, etc.) — five-minute add, no reason to defer |
| Per-user AI throttle | Custom middleware using a lightweight in-memory/Redis counter | Prevents one user from exhausting the whole project's Gemini RPM quota in a burst |

---

## PART C — Requirements (Delta Only)

### C.1 Functional Requirements — Updated/New
| ID | Requirement |
|---|---|
| FR-9 *(updated)* | User can upgrade to Premium via **RevenueCat-triggered native IAP** (Apple/Google), not Stripe |
| **FR-15 (new)** | Backend must rate-limit `/api/chat` and `/api/analyze-homework` per authenticated user (e.g., 10 req/min), independent of the daily free-tier cap |
| **FR-16 (new)** | Chat requests sent to Gemini must include only the most recent ~10 messages of a thread, not the full history |
| **FR-17 (new)** | Common/repeated questions are served from a cache where possible, before calling Gemini |
| **FR-18 (new)** | User can request full account/data deletion from within the app (not just a policy statement — an actual endpoint) |

### C.2 Non-Functional Requirements — Updated/New
| ID | Requirement |
|---|---|
| **NFR-11 (new)** | All backend routes must have `helmet` security headers applied |
| **NFR-12 (new)** | Authentication endpoints must be rate-limited (minimum: 5 attempts/min per IP on login) |
| **NFR-13 (new)** | Backend inserts to RLS-protected tables must carry the authenticated user's session context — the anon key alone is insufficient and will silently fail inserts under RLS |
| **NFR-14 (new)** | Usage monitoring must track DAU/MAU and cost-per-feature, not just aggregate monthly spend |

### C.3 Legal / Compliance — Updated
| ID | Requirement |
|---|---|
| LR-5 *(replaced)* | ~~Stripe/payment data never touches your own servers~~ -> **Apple/Google handle all payment collection via native IAP; RevenueCat only relays subscription status, never raw payment data** |

---

## PART D — KPI Roadmap (Delta: New/Changed Tickets Only)

### Phase 0 — Updated
| Task | KPI |
|---|---|
| ~~Create Stripe test account~~ -> **Create RevenueCat project** | RevenueCat project exists, public API key saved in `.env` |
| **(new) Install `express-rate-limit` + `helmet`** | Both packages present in `package.json`, applied globally in `server.ts` |

### Phase 1 — Updated
| Task | KPI |
|---|---|
| **(new) Verify RLS insert policy exists for every table with a `for insert` case** | `profiles` and `students` both have working insert policies; test registration succeeds end-to-end, not just the auth step |
| **(new) Backend forwards user session/JWT to Supabase client on writes**, not just the anon key | A registered user's own `profiles` row insert succeeds under RLS |

### Phase 2 — Updated (two new tickets added)
| Task | KPI |
|---|---|
| **(new) Add per-user rate limiter on `/api/chat`** | A user sending 11 requests within 1 minute gets a friendly "slow down" response on the 11th, not a Gemini-quota failure |
| **(new) Trim chat history to last ~10 messages before sending to Gemini** | A 50-message-long thread's Gemini request payload stays roughly constant size, not growing unbounded |

### Phase 5 — Updated
| Task | KPI |
|---|---|
| ~~Wire Paywall to Stripe Checkout~~ -> **Wire Paywall to RevenueCat purchase flow** | "Upgrade" opens native Apple/Google purchase sheet |
| ~~Build Stripe webhook handler~~ -> **Build RevenueCat webhook handler** | Successful test purchase flips `is_premium = true` |
| **(new, promoted from optional) Add basic response caching** | Repeated common questions ("what is 5+5") are served from cache, confirmed via reduced Gemini request count in logs |
| **(new) Expand usage tracker to DAU/MAU + cost-per-feature** | Dashboard/query shows daily active users, monthly active users, and cost split between chat vs. image scans |
| **(new) Add per-user rate limiter on `/api/analyze-homework`** | Same pattern as the chat limiter above |

### Phase 6 — Updated
| Task | KPI |
|---|---|
| **(new) Build account/data deletion endpoint** | A user can trigger full deletion of their profile, students, and messages; confirmed via DB check post-deletion |

---

## Bottom Line

Two categories of changes here: a **business-necessity swap** (Stripe -> RevenueCat, driven by Pakistan's payment landscape, which also happens to be the more compliant choice for Apple's Kids Category), and a **security/cost hardening pass** (rate limiting, RLS session context, history trimming, caching, deletion) that came out of actually auditing the real code we built in Phase 0/1 rather than just the plan on paper. Nothing here changes the overall shape or timeline meaningfully — these are the kind of fixes that are cheap now and expensive later if skipped.
