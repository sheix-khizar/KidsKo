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
| **H1** | Chat history list grouped by date (Today, Yesterday, 7 Days, Older) | Stage 6 & 7 | ⏳ **Not Yet Built** | Thread list backend scheduled for Stage 6. |
| **H2** | Tap past chat to load messages and continue conversation | Stage 7 | ⏳ **Not Yet Built** | History drawer scheduled for Stage 7. |
| **H3** | Force-close app, reopen, continue past chat without context loss | Stage 7 | ⏳ **Not Yet Built** | Relies on threadId persistence in drawer. |
| **H4** | 48-hour photo expiration note ("Photo removed after 2 days for privacy") | Stage 6 & 7 | ⏳ **Not Yet Built** | Backend `imageExpired` flag scheduled for Stage 6. |
| **H5** | Delete chat thread behind ParentalGate | Stage 7 | ⏳ **Not Yet Built** | Protected deletion scheduled for Stage 7. |
| **M1** | Child memory recall in new chat ("knows my name across sessions") | Stage 9 | ⏳ **Not Yet Built** | `student_memory` engine scheduled for Stage 9. |
| **M2** | Memory toggle switch OFF stops fact extraction & prompt injection | Stage 9 & 10 | ⏳ **Not Yet Built** | Parent memory settings scheduled for Stage 10. |
| **M3** | "Forget everything" button in Parents Hub erases all stored facts | Stage 9 & 10 | ⏳ **Not Yet Built** | Parent memory settings scheduled for Stage 10. |
