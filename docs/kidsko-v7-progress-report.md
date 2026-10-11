# Kidsko.ai — v7 / v7.1 Progress Report

**Repo:** `sheix-khizar/KidsKo` · **State reviewed:** `dev` at `a3430c7` (Oct 11, 23:23 local) · **Method:** read the code and diffs on GitHub, installed dependencies and ran `tsc` on both apps. I did **not** run the app, the backend tests, or anything against Supabase/Gemini.

---

## 1. Executive summary

All twelve stages of the combined guide are marked done, and the redesign is merged into `dev`. The code backs up most of that. The protected files were respected, the memory and history backends match the plan, and both apps type-check cleanly.

The project is **not ready to ship yet**. Four things stand between you and a release:

1. A **broken `npm ci` on the backend** (lockfile out of sync). This can fail a clean deploy.
2. **Chat conversations are lost** when switching tabs or returning from a call.
3. A **privacy gap**: a parent cannot erase a remembered name if no facts were stored.
4. **No real-device evidence** for the call baseline and the release build.

None of these needs a redesign. Together they are about a day of fixes plus a device test session.

---

## 2. Stage status

| Stage | Plan | Status | Evidence in code |
|---|---|---|---|
| 1 | Bug fixes (cache privacy, `cleanMessageText`) | Done | `cache.ts`, `chat.ts`, `messageText.ts` |
| 2 | Safety net | Done | `pre-v7` tag at `bcb92e3`, checklist, docs archived |
| 3 | Design system | Done | `theme/`, `ui/`, Nunito loaded in `App.tsx` |
| 4 | Loader, Login, Register | Done | Commit `8c41b34` |
| 5 | Navigation shell | Done, with defects (see 4.2) | `MainShellScreen`, `TabBar`, back handler |
| 6 | History backend | Done | `20261011_chat_history.sql`, two endpoints |
| 7 | Chat restyle + history drawer | Done, with defects | `ChatHistoryDrawer`, chips, `threads.ts` |
| 8 | Call restyle (visual only) | Done in code; gate not met | `LiveVoiceScreen.tsx` diff is visual only |
| 9 | Memory backend | Done | `studentMemory.ts`, `students.ts`, migration |
| 10 | Paywall, Transcript, Parents hub | Done, with a gap (see 4.3) | `ParentsHub.tsx`, `PaywallScreen.tsx` |
| 11 | Polish, accessibility, regression | Done in code | accessibility labels, 44 pt targets, style guide removed |
| 12 | Ship | **Partly done** | Merged to `dev`; no release build or device run recorded |

**Overall:** about 11 of 12 stages complete in code; the shipping checks (device tests, release build) are the missing part.

---

## 3. What I verified is correct

- **Guardrails held.** Against `pre-v7`, `voiceSocket.ts`, `voiceSocketServer.ts`, `geminiLive.ts` and every `services/*` file are untouched, except `threads.ts` (new) and the memory functions added to `api.ts`.
- **`LiveVoiceScreen.tsx`** changes are visual only: styles, text, a timer-pill wrapper, accessibility labels and hit areas. No hook, ref, effect, frame loop or socket handler changed. Android back is safe because the screen ends the session when it unmounts.
- **`ChatScreen.tsx`** logic changes stay inside the four allowed places (`cleanMessageText`, `embedded`, chips, history drawer).
- **`ParentalGate`** math logic is unchanged; Stage 11 added accessibility props and minimum sizes only.
- **Cache privacy** matches the plan: personal messages bypass the cache, replies containing the child's name are not cached, the key is versioned `v2:`.
- **History backend:** ownership checks return 404 for other parents' data; paging and `imageExpired` work as designed; the trigger is `SECURITY DEFINER`.
- **Memory backend:** facts and names pass a server-side filter; extraction runs without blocking the reply; the three parent endpoints check ownership; deleting a child cascades to memory.
- **Paywall:** the simulated purchase only runs when `__DEV__` is true; a release build shows an error if a package fails to load.
- **Type-checks:** `tsc --noEmit` passes with no errors on both `mobile` and `backend` (I ran it).
- **No secrets** are committed (only `.env.example` files).
- **Docs:** legacy plans moved to `docs/archive/`, the prototype renamed, and the style-guide route removed.

---

## 4. Problems found

### 4.1 Release-blocking

**A. Backend lockfile is out of sync, so `npm ci` fails.**
`backend/package.json` lists `multer` and `@types/multer`, but `package-lock.json` does not contain them. `npm ci` errors, and `npm install` rewrites about 150 lines of the lockfile. Any CI or hosting build that uses `npm ci` will fail. Fix: run `npm install` in `backend/` and commit the updated lockfile.

**B. No real-device evidence for the call and the release build.**
- The Stage 8.0 entry gate (5-minute call with video toggled twice on a budget Android phone) is recorded as "verified on Android emulator / dev environment".
- The Stage 12 sign-off says "verified live on Android emulator" and records no EAS release build, no budget-device run and no store screenshots. The plan's Definition of Done requires a release build on one iOS and one budget Android device.
- The checklist's Stage 11 rows ("tested on budget Android device", "no dropped frames", "stability matches baseline") are written as results but carry no logs or screenshots, so treat them as unconfirmed until someone repeats them.

### 4.2 Functional bugs (not fixed since my earlier reviews)

| # | Problem | Where | Effect |
|---|---|---|---|
| 1 | Chat is unmounted when the tab changes (`tab === 'chat' &&`), and the whole shell remounts after a call, transcript or paywall | `MainShellScreen.tsx:179`, `App.tsx` | A child loses an in-progress conversation and the draft. History reduces the damage, but it contradicts the Step 3.3 and 3.4 checks. |
| 2 | Call tab shows "Free plan: 10 minutes…" to everyone | `MainShellScreen.tsx:241` | Premium users see wrong limits. |
| 3 | History endpoint returns the oldest 200 messages | `chat.ts:294` | In a chat longer than 200 messages, reopening it hides the newest ones. |
| 4 | "Yesterday" computed as today minus 24 hours | `groupThreads.ts:26` | Wrong around clock changes. No test exists for the grouping helper. |

### 4.3 Privacy and cost

| # | Problem | Detail |
|---|---|---|
| 5 | **A parent can't erase a remembered name.** | The "Forget Everything" button only shows when there is at least one fact (`ParentsHub.tsx:303`). A child who only said their name has a stored `preferredName` and no facts, so there is no button. There is also no way to remove the name by itself. |
| 6 | **The response cache is effectively off for everyone.** | `buildMemoryBlock` falls back to the profile name, so it returns text for almost every child. `chat.ts:378` treats any non-empty block as "active memory" and skips the cache. This follows my own v7.1 wording, but it removes the cost saving from v6. Fix: bypass only when a preferred name or facts are actually stored. The name-in-reply guard still protects cache writes. |
| 7 | **Extraction can run too often.** | `isPersonalMessage` matches "I'm", "I am", "im ". "I'm stuck" triggers an extra Gemini call. Add a cheap pre-filter or a per-thread cap. |
| 8 | **The fact filter limits shape, not content.** | `Likes: Oakridge School` or `Likes: ignore your rules` would pass the regex. Parents can see and delete facts, but this is not injection-proof. Names or facts in Urdu script are rejected (A–Z only). |
| 9 | Invalid names sent to the memory API silently clear the stored name; two simultaneous extractions can overwrite each other. | `students.ts`, `studentMemory.ts` |
| 10 | If loading the memory screen fails, the UI shows memory as "Active" with no facts, which may be wrong. | `ParentsHub.tsx` |

### 4.4 Quality and plan-compliance

- **Safe areas:** `Screen.tsx` still uses React Native's built-in `SafeAreaView`, which was deprecated in RN 0.81 and does nothing on Android. The code guesses with `StatusBar.currentHeight / 2`. `expo-linear-gradient` and `react-native-safe-area-context` are installed but unused. The `TabBar` has fixed bottom padding. Check a notched phone and a gesture-navigation phone.
- **Hardcoded colours remain** (34 hex values in `LiveVoiceScreen.tsx`, 20 in `HomeworkScreen.tsx`, and a few in `ChatScreen`, `ParentsHub`, `ParentalGate`, `ServerConfigModal`). The v7 Definition of Done says none should remain in screen files. `LiveVoiceScreen` is explained by the visual-only rule; decide to exempt it explicitly.
- **Weak backend tests:** the cache test re-implements the name-matching logic instead of calling the route; the history test re-runs the database queries instead of calling the endpoints. The pass counts (26, 35, 30) are only as strong as that.
- **Dead code:** `scanThreadId`/`scanExplanation` in `App.tsx`, the orphaned `HomeworkScreen.tsx`, an unused `loading` style.
- **Migration check:** confirm the real name of the `usage_events` check constraint. If it isn't `usage_events_event_type_check`, `'memory'` events fail to log (memory itself still works).

---

## 5. Claims in the checklist versus what I could confirm

| Claim | Confirmed? |
|---|---|
| `tsc` has 0 errors on mobile and backend | **Yes** (I ran both) |
| Protected files unchanged | **Yes** (diffs against `pre-v7`) |
| Backend changes limited to v7.1 files | **Yes** |
| Test counts 26/26, 35/35, 30/30 | **No** (not run; they need live Supabase and Gemini) |
| Live Gemini recall of the child's name | **No** |
| Budget-Android 5-minute call, no stutter | **No** (recorded as emulator only) |
| Contrast, touch targets, font scaling tables | **Partly** (accessibility props and 44 pt sizes are in the code; contrast and font-scale results are not reproducible) |
| Release build on real devices | **No evidence** |

---

## 6. Recommended next steps

**Before any release (about 1 to 1.5 days):**
1. Fix the backend lockfile and commit it.
2. Keep `ChatScreen` mounted and keep the tab and selected child across call, transcript and paywall (item 4.2.1).
3. Show the real plan on the Call tab or neutral text (4.2.2).
4. Fix the Parents hub so a stored name can be viewed and erased even with no facts (4.3.5).
5. Narrow the cache bypass to children with a preferred name or facts (4.3.6).
6. Return the newest 200 messages in ascending order (4.2.3); fix "yesterday" with calendar dates and add a small test (4.2.4).

**Device and release (about 1 day):**
7. Run the 5-minute call with video toggled twice on a budget Android phone and record it.
8. Run `npx expo install --check`, build an EAS release build, and run the full checklist on it on one Android and one iOS device.
9. Test a notched phone and a gesture-navigation phone for safe-area problems.

**Then:**
10. Cap or pre-filter memory extraction (4.3.7).
11. Start Track B: remove the leftover snapshot and `daily_*` columns, account deletion, minimal Settings, jailbreak test, privacy policy and store assets.

---

## 7. What I could not check

- Whether the migrations were applied to your Supabase project, and whether row-level security policies exist as the plan assumes.
- Behaviour on a device or emulator, release-build behaviour, and the real call quality.
- Whether the billed Gemini key is in use (a launch blocker in v6).

---

## 8. Sources

React Native 0.81 release notes (SafeAreaView deprecation): https://reactnative.dev/blog/2025/08/12/react-native-0.81
