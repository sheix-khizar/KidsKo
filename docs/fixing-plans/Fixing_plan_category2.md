# Kidsko.ai — Implementation Plan: Category 2 (Parental Controls & Security)

**Document:** `docs/fixing-plans/Fixing_plan_category2.md`  
**Date:** October 30, 2026  
**Status:** Approved for Implementation  
**Focus Area:** Category 2 — Security PIN, Account/Profile Deletion & Granular Parental Controls  
**Covers:**
- **Issue #5**: Security PIN / Password in Parental Gate instead of a trivial math addition question
- **Issue #7**: Child profile deletion and complete parent account deletion (App Store Guideline 5.1.1 & Google Play Families compliance)
- **Issue #2 Part A**: Granular parental controls (call permissions, bedtime curfew, homework-only mode, and daily time limits)

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 The Challenge
During physical device testing and app store readiness audits, three critical parental control and privacy compliance gaps were identified:
1. **Trivial Math Gate Bypass (Issue #5):** The current `ParentalGate.tsx` presents a simple math addition question (e.g. `What is 12 + 15?`). Target users aged 7–12 easily calculate the answer, bypassing the gate and gaining unauthorized access to Parents Hub, student memories, subscriptions, and adult settings.
2. **Missing Account & Profile Deletion (Issue #7):** 
   - Neither the mobile app nor the backend API provides a way to delete a child's profile or permanently delete the parent's account.
   - **Store Rejection Risk:** Apple App Store Review Guideline 5.1.1(v) explicitly mandates: *"If your app supports account creation, you must also offer account deletion within the app."* Google Play Families Policy also strictly requires an accessible user data deletion mechanism.
3. **Lack of Granular Controls (Issue #2 Part A):** Parents currently have no way to restrict call features (e.g. disable video camera for privacy), set evening bedtimes/curfews, or enforce strict homework-only mode.

### 1.2 Target Experience vs Current State

| Feature | Current Implementation | Target Experience (Category 2) |
|---|---|---|
| **Parental Gate (Issue #5)** | Random addition problem (`a + b`) | Secure 4-digit Parent PIN with numeric keypad, error lockout, and password reset fallback |
| **Child Profile Deletion (Issue #7)** | Non-existent; children cannot be removed | Parent can permanently delete a child profile with full cascade wipe of memories, transcripts, and images |
| **Parent Account Deletion (Issue #7)** | Non-existent; accounts cannot be deleted | Dedicated in-app account deletion flow purging all user records from Supabase auth and database |
| **Call Permissions (Issue #2A)** | Both voice and video always open | Granular toggles: Voice Enabled (On/Off), AI Vision Camera (On/Off) |
| **Time Curfew / Bedtime (Issue #2A)** | No time-of-day restrictions | Configurable bedtime curfew (e.g. 8:00 PM – 7:00 AM) locking live calls with a gentle child-friendly notice |
| **Homework-Only Mode (Issue #2A)** | AI always engages in playful banter | Optional toggle instructing AI to maintain strict academic focus |

---

## 2. Store Compliance & Security Architecture

1. **COPPA & Store Data Retention Compliance:**
   - Deleting a child profile must cascade delete all rows in `student_memory`, `chat_messages`, `transcripts`, `homework_drafts`, and purge all stored worksheet photos from Supabase storage buckets.
   - Account deletion must call `supabase.auth.admin.deleteUser(userId)` to completely purge the parent credentials from the identity system.
2. **PIN Security Architecture:**
   - Store the PIN hash using `expo-secure-store` on the device with a cryptographic salt (e.g. SHA-256).
   - If the parent forgets their PIN, provide an immediate escape hatch: authenticate with the Parent account password to reset the PIN.
3. **Defensive API Authorization:**
   - All deletion and control mutation endpoints must verify that `parent_id === req.user.id` to prevent any cross-tenant data tampering.

---

## 3. Phase-by-Phase Implementation Plan

```
┌────────────────────────────────────────────────────────┐
│  Phase 1: Parent Security PIN Engine (Issue #5)        │
│  - Replace math gate with 4-digit PIN in ParentalGate  │
│  - Setup flow (create PIN + confirm PIN)               │
│  - Verification modal (4 dots, numpad, shake on error) │
│  - Forgot PIN fallback via account password re-auth    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 2: Child Profile Deletion Engine (Issue #7)     │
│  - Backend: DELETE /api/students/:id with cascade wipe │
│  - Mobile: "Delete Child Profile" in Parents Hub       │
│  - Safety prompt + PIN confirmation                    │
│  - Dynamic child list & active student re-indexing     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 3: Parent Account Deletion Suite (Issue #7)     │
│  - Backend: DELETE /api/auth/account (full purge)      │
│  - Supabase admin user delete + storage bucket cleanup │
│  - Mobile: Multi-step "Delete Account" flow in Hub     │
│  - Token wipe, session purge & redirect to login       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 4: Granular Parental Controls Suite (Issue #2A) │
│  - DB/State: call_perms, curfew_hours, homework_mode   │
│  - Parents Hub: Controls card with toggles & curfew    │
│  - Shell & Call Enforcement: Bedtime screen lock       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 5: Security Battery & Compliance Verification   │
│  - PIN brute-force lockout test                        │
│  - Deletion cascade data retention audit               │
│  - App Store 5.1.1 & Play Families policy sign-off     │
│  - Full build & TypeScript checks (0 errors)           │
└────────────────────────────────────────────────────────┘
```

---

### Phase 1: Parent Security PIN Engine (Issue #5)
* **Target Files:**
  * `mobile/src/services/security.ts` (new security service)
  * `mobile/src/components/ParentalGate.tsx`
  * `mobile/src/screens/MainShellScreen.tsx`
* **Implementation Details:**
  1. **Security Service (`security.ts`):**
     * Use `expo-secure-store` for hardware-backed encrypted storage.
     * Functions:
       - `isParentPinSet(): Promise<boolean>`
       - `setParentPin(pin: string): Promise<void>`
       - `verifyParentPin(enteredPin: string): Promise<boolean>`
       - `resetParentPinWithPassword(password: string): Promise<boolean>`
  2. **ParentalGate Component Overhaul (`ParentalGate.tsx`):**
     * **Mode 1: Setup PIN (First-time access):**
       - Title: *"Create Parent PIN"*.
       - Subtitle: *"Set a 4-digit security code to protect parental controls."*.
       - Step 1: Enter 4 digits -> Step 2: Confirm 4 digits -> Saved.
     * **Mode 2: Enter PIN (Standard access):**
       - 4 circular pin status dots (empty/filled with smooth scale animation).
       - Custom kid-proof numeric keypad (1–9, 0, Backspace).
       - Visual error feedback: Horizontal shake animation + *"Incorrect PIN. Try again."*.
       - Rate limiting: Lockout for 60 seconds after 5 consecutive incorrect attempts.
     * **Mode 3: Forgot PIN?:**
       - Tap *"Forgot PIN?"* -> Prompts parent to enter their account password.
       - Validates password against `POST /api/auth/login`. On success, prompts to create a new PIN.

---

### Phase 2: Child Profile Deletion Engine (Issue #7 - Part 1)
* **Target Files:**
  * `backend/src/routes/students.ts`
  * `mobile/src/services/api.ts`
  * `mobile/src/components/ParentsHub.tsx`
* **Implementation Details:**
  1. **Backend Endpoint (`DELETE /api/students/:id`):**
     * Verify caller authentication (`requireAuth`) and student ownership (`parent_id === req.user.id`).
     * Transactional cascade deletion:
       ```sql
       -- Delete memory records
       DELETE FROM student_memory WHERE student_id = :id;
       -- Delete chat messages & transcripts
       DELETE FROM chat_messages WHERE student_id = :id;
       -- Delete worksheet attachments metadata
       DELETE FROM homework_drafts WHERE student_id = :id;
       -- Delete student profile row
       DELETE FROM students WHERE id = :id AND parent_id = :userId;
       ```
     * Return `200 OK` with `{ success: true, studentId }`.
  2. **Mobile UI in `ParentsHub.tsx`:**
     * Under the active child's profile card, add a discrete, red-bordered button: *"🗑️ Delete Child Profile"*.
     * **Multi-Step Safety Confirmation:**
       1. First Alert: *"Are you sure you want to delete {student_name}'s profile? All homework history, chat messages, and learning memories will be permanently erased."*
       2. Security PIN Prompt: Must enter the 4-digit Parent PIN to authorize deletion.
     * On successful deletion:
       - Refreshes student list via `onRefreshStudents()`.
       - Automatically selects the next remaining child profile or displays the clean first-run state if no children remain.

---

### Phase 3: Parent Account Deletion Suite (Issue #7 - Part 2)
* **Target Files:**
  * `backend/src/routes/auth.ts`
  * `mobile/src/services/api.ts`
  * `mobile/src/components/ParentsHub.tsx`
* **Compliance Requirement:** Apple App Store Guideline 5.1.1(v) & Google Play Families Data Safety.
* **Implementation Details:**
  1. **Backend Endpoint (`DELETE /api/auth/account`):**
     * Protected by `requireAuth`.
     * Data Purge Sequence:
       1. Identify all student IDs belonging to `req.user.id`.
       2. Delete all records from `student_memory`, `chat_messages`, `homework_drafts`, `students`, and `family_usage`.
       3. Delete row from `profiles`.
       4. Call Supabase Admin API: `supabase.auth.admin.deleteUser(req.user.id)` to erase login credentials from authentication tables.
       5. (Optional) Cleanup any user-uploaded files from Supabase Storage buckets.
  2. **Mobile UI in `ParentsHub.tsx`:**
     * At the bottom of the Parent Dashboard, add an *"Account & Data Management"* section.
     * Prominent destructive action button: *"Delete Parent Account & All Data"*.
     * **Safety Confirmation Protocol:**
       1. Modal explains that account deletion is permanent and cannot be undone.
       2. Requires parent to type `"DELETE"` into a confirmation field.
       3. Requires 4-digit Parent PIN entry.
     * On success:
       - Clears auth token (`clearToken()`).
       - Clears all saved credentials from `SecureStore`.
       - Emits `onLogout()` to reset navigation stack and return user to Welcome/Login screen.

---

### Phase 4: Granular Parental Controls Suite (Issue #2 - Part A)
* **Target Files:**
  * `backend/src/db/` or `student_controls` table
  * `backend/src/routes/students.ts`
  * `mobile/src/components/ParentsHub.tsx`
  * `mobile/src/screens/MainShellScreen.tsx`
  * `mobile/src/screens/LiveVoiceScreen.tsx`
* **Implementation Details:**
  1. **Granular Control Settings Per Child:**
     * `allow_voice_calls`: Boolean (Enable/disable voice calling).
     * `allow_video_camera`: Boolean (Enable/disable camera & AI Vision).
     * `curfew_enabled`: Boolean (Enable/disable evening bedtime lock).
     * `curfew_start_time`: String (e.g. `"20:00"` / 8:00 PM).
     * `curfew_end_time`: String (e.g. `"07:00"` / 7:00 AM).
     * `homework_focus_mode`: Boolean (Instructs AI to focus strictly on academic questions and decline playful off-topic games).
  2. **Parent Dashboard Controls Card (`ParentsHub.tsx`):**
     * Clean toggle rows with informative subheadings:
       - 🎙️ **Voice Calls**: *"Allow child to have spoken conversations with Kidsko"*.
       - 📷 **AI Vision Camera**: *"Allow child to point camera at homework"*.
       - 🌙 **Bedtime Curfew**: *"Lock calls during nighttime hours (8:00 PM – 7:00 AM)"*.
       - 📚 **Strict Homework Mode**: *"Keep AI responses 100% focused on schoolwork"*.
  3. **Enforcement in Call Tab & Live Call Screen:**
     * If bedtime curfew is active and the current local time falls within curfew hours:
       - Call button in `MainShellScreen.tsx` is disabled with a peaceful bedtime banner: *"Kidsko is sleeping! 🌙 Call hours resume at 7:00 AM."*.
     * If `allow_video_camera === false`:
       - The "AI Vision" card is hidden or locked with a *"Camera disabled by parent"* badge.

---

### Phase 5: Security Battery & Compliance Verification
* **Verification Matrix:**

| Test # | Check Item | Target Criteria |
|---|---|---|
| **V1** | PIN Setup & Confirmation | Creating a 4-digit PIN saves securely and prevents unauthorized access |
| **V2** | Incorrect PIN Handling | Shakes on wrong PIN; locks out for 60 seconds after 5 failed attempts |
| **V3** | Forgot PIN Escape Hatch | Verifying parent account password successfully resets the PIN |
| **V4** | Child Profile Deletion | Deleting a child cascades to wipe all their memories, chat history, and images |
| **V5** | Remaining Children Re-indexing | Deleting one child leaves remaining siblings intact; switching works smoothly |
| **V6** | Parent Account Deletion | Deletes user from Supabase auth, purges all database tables, and routes to login |
| **V7** | Camera Permission Toggle | Disabling camera permission disables AI Vision card and blocks camera in-call |
| **V8** | Bedtime Curfew Enforcement | During curfew hours, call initiation is gracefully blocked with child-safe notice |
| **V9** | Store Policy Audit | Fully satisfies Apple Guideline 5.1.1 and Google Play Families Data Safety rules |
| **V10** | TypeScript & Build | `npx tsc --noEmit` and `npm run build` pass with 0 errors |

---

## 4. Definition of Done (DoD)

- [ ] 1. `ParentalGate.tsx` requires a secure 4-digit Parent PIN instead of a trivial math addition question.
- [ ] 2. Parent PIN setup, validation, lockout, and password-reset flows work seamlessly.
- [ ] 3. `DELETE /api/students/:id` backend route permanently removes child profile with cascading data cleanup.
- [ ] 4. Parents Hub features a secure child profile deletion flow protected by the Parent PIN.
- [ ] 5. `DELETE /api/auth/account` permanently purges all parent and child records from database and Supabase Auth.
- [ ] 6. Parents Hub features a prominent, multi-step account deletion flow satisfying App Store Guideline 5.1.1.
- [ ] 7. Granular controls (Voice toggle, Camera toggle, Bedtime curfew, Homework focus mode) are configurable and enforced.
- [ ] 8. Both backend and mobile compile cleanly with zero TypeScript errors.
