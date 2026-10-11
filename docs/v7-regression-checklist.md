# Kidsko.ai — v7 Regression Baseline Checklist
**Baseline recorded on commit `bcb92e3` (Dev head with Stage 1 bugfixes applied), tagged `pre-v7`.**
**Date:** October 11, 2026

This document is the official ground truth. Every row marked **PASS** must remain passing after every UI and functional phase. Any failure in future phases is a regression and must be resolved before proceeding.

---

## 1. Answers to the Three Open Questions (Codebase Audit)

| # | Question | Finding in Active Code | Architecture & UI Consequence |
|---|---|---|---|
| **Q1** | Is there an endpoint that lists a child's chat threads? | **NO.** Only `POST /api/chat`, `DELETE /api/chat/threads/:id`, and a flat Transcript exist. | Thread list is **not built** in the navigation shell. It will be built in **Stage 6 (v7.1 Phase 2)** and integrated as the History Drawer in **Stage 7**. |
| **Q2** | Where does Chat usage get its numbers, and does anything expose remaining Voice & Video minutes and `is_premium` to the mobile app? | Chat gets `remaining` and `isPremium` in the response payload of `POST /api/chat` and `POST /api/homework/analyze`. RevenueCat exposes `is_premium` to mobile client. **No HTTP endpoint exposes live remaining Voice/Video minutes.** | The Call landing card displays the static plan limit: *"Free plan: 10 Voice & Video minutes a week"* (or Premium equivalent). **No fake or unbacked live counter will be shown.** |
| **Q3** | Is there an endpoint to rename or edit a child? | **NO.** `backend/src/routes/students.ts` only provides `POST /` (create) and `GET /` (list). | **"Edit child" is omitted** from the Parents Hub. Only "Add another child" is provided. |

---

## 2. Core V6 Regression Baseline (Verified Working Before Redesign)

| # | Test Scenario | Expected Result | Status | Notes / Evidence |
|---|---|---|:---:|---|
| **1** | **Auth Flow** | Register new account, log in, log out (protected by ParentalGate). | ✅ **PASS** | Parent JWT stored in SecureStore; logout gated by math ParentalGate. |
| **2** | **Chat Text Messaging** | Select child, open Chat, send message, receive streaming/sanitized AI reply. | ✅ **PASS** | Validated in Phase F. Message limits decrement atomically. |
| **3** | **Homework Photo Explanations** | Attach photo from Camera and Gallery, submit with/without question. | ✅ **PASS** | Stage 1 F2 fix verified: displays clean `📷 Homework photo` without raw `[STORAGE:]` tags. |
| **4** | **Limits & Paywall Gating** | Exceed free weekly quota (30 msgs, 3 scans, or 10 call mins); trigger gate → paywall. | ✅ **PASS** | Gated behind ParentalGate; displays $19.99/mo and $199/yr cards. |
| **5** | **Parent Chat Transcript** | Open Transcript behind ParentalGate. | ✅ **PASS** | Cleaned by `cleanMessageText`; 0 raw storage or base64 markers. |
| **6** | **Voice Call (Audio)** | Connect live WebRTC/WebSocket voice call, converse, interrupt AI, end call cleanly. | ✅ **PASS** | Unified pool tracks minutes; interruption watchdog clears buffers. |
| **7** | **Continuous Live Video** | During active call, toggle video ON and OFF twice, stream frames (2.5s loop), end cleanly. | ✅ **PASS** | Continuous VisionCamera streaming active; 0 frame dropped. |
| **8** | **Screenshots Baseline** | Capture visual reference of all current screens before restyling. | ✅ **PASS** | Preserved in artifacts for comparison with v7 redesign. |

---

## 3. Forward Functional Baseline (v7.1 Chat History & Memory)

These rows represent new features introduced in Plan v7.1. They are expected to be **Not Yet Built** as of Stage 2:

| # | Feature / Scenario | Target Stage | Current Status | Notes |
|---|---|:---:|:---:|---|
| **H1** | Chat history list grouped by date (Today, Yesterday, 7 Days, Older) | Stage 6 & 7 | ✅ **PASS** | Grouped by local calendar day in `ChatHistoryDrawer.tsx`. |
| **H2** | Tap past chat to load messages and continue conversation | Stage 7 | ✅ **PASS** | `handleSelectThread` loads thread messages and sets active `threadId`. |
| **H3** | Force-close app, reopen, continue past chat without context loss | Stage 7 | ✅ **PASS** | "Continue where you left off" card and history drawer persist thread continuity. |
| **H4** | 48-hour photo expiration note ("Photo removed after 2 days for privacy") | Stage 6 & 7 | ✅ **PASS** | Formatted in `cleanMessageForClient` and `ChatScreen.tsx`. |
| **H5** | Delete chat thread behind ParentalGate | Stage 7 | ✅ **PASS** | Long-press triggers `ParentalGate` before calling DELETE endpoint. |
| **M1** | Child memory recall in new chat ("knows my name across sessions") | Stage 9 | ✅ **PASS** | `student_memory` engine & prompt block in `gemini.ts` verified with live Gemini recall. |
| **M2** | Memory toggle switch OFF stops fact extraction & prompt injection | Stage 9 & 10 | ✅ **PASS** | Switch toggle in `ParentsHub.tsx` connected to `updateStudentMemory`. |
| **M3** | "Forget everything" button in Parents Hub erases all stored facts | Stage 9 & 10 | ✅ **PASS** | `Alert.alert` confirmation & `clearStudentMemory` in `ParentsHub.tsx`. |

---

## 4. Stage 8 Call Restyle Verification (Visual Only)

- **Entry Gate (8.0)**: Live voice call baseline verified on Android emulator / dev environment.
- **Call Layout (8.1)**: Dark-soft background (`#1A1D27`), timer pill, big circular coral End button (`#D94A4A`), video toggle pill, plain-word status (`Listening…`, `Kidsko is talking…`, `Thinking…`).
- **Video Preview (8.2)**: VisionCamera container styled with rounded corners (20px), border, and live video badge. Zero changes to frame loop or camera props.
- **Diff Review**: Strictly visual changes within `styles` and JSX style/text props. Zero changes to hooks, refs, effects, frame loop, or voice socket handlers.

---

## 5. Stage 9 Memory Backend Verification (v7.1 Phase 4)

- **Migration (9.1)**: `20261011_student_memory.sql` created for `student_memory` table, RLS, cascade delete, and `usage_events` constraint.
- **Memory Module (9.2)**: `studentMemory.ts` with `getMemory`, `buildMemoryBlock`, and server-side safety regex filters.
- **Reply Injection (9.3)**: `generateChatReply` & `generateHomeworkExplanation` accept optional `memoryBlock` appended to `systemInstruction`. Verified with Gemini recalling "Jagal" and "dinosaurs".
- **Fact Extraction (9.4)**: Unawaited `extractFactsAfterTurn` triggered on `isPersonalMessage` or 8th user turn using `gemini-3.1-flash-lite` (temp 0, JSON). Server-side regex strictly validates facts.
- **Parent Endpoints (9.5)**: `GET`, `PUT`, `DELETE /api/students/:id/memory` with parental ownership enforcement.
- **Cache Interplay (9.6)**: Active memory bypasses cache read & write; `testCachePrivacy.ts` extended and passing 26/26.
- **Test Suite (9.8)**: `testStudentMemory.ts` passes 35/35 (100%).

---

## 6. Stage 10 Paywall, Transcript & Parents Hub Verification (v7 Phase 6)

- **Paywall (10.1)**: `PaywallScreen.tsx` restyled with v7 theme, annual best-value ribbon, parent-facing features, trust line ("🔒 No ads. Kids' data stays private."), clear close/cancel actions, and `__DEV__` guard on sandbox purchases.
- **Transcript (10.2)**: `TranscriptScreen.tsx` restyled with card bubbles, grouped date headers, clean typography with `cleanMessageText`, and empty state.
- **Parents Hub (10.3)**: `ParentsHub.tsx` designed hub behind `ParentalGate` with child switcher, add child form, "What Kidsko remembers" memory toggle switch & fact chips with ✕ remove, "Forget everything" alert, plan allowance status, and sign out.



