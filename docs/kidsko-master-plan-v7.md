# Kidsko.ai — Master Plan (v7.0, UI/UX Redesign)
**A visual and navigation redesign of the working v6 app, using the v7 prototype as the design reference. Functionality, backend and business rules do not change.**

Supersedes nothing in v6. Every product rule in `kidsko-master-plan-v6.md` (tiers, weekly limits, Call/Chat boundary, RevenueCat, parental gate, retention) carries over unchanged. This plan only changes how Kidsko looks, feels and is navigated.

**Who this is for:** the founder executing one step at a time, and any AI coding agent given a single step as its task. Each step has a goal, files, instructions, a "do not" list and a Definition of Done (DoD).

---

## 1. Summary

The app works (v6 Phases A to F are done in the repo) but looks like an engineering build: hardcoded hex colors in eight separate `StyleSheet`s, a Home screen made of small buttons, and no shared design language. The v7 prototype (`docs/kidsko-v7.html.txt`, actually JSX) shows the intended look: warm cream background, coral/orange/mint palette, owl mascot, large rounded cards, and a three-tab bottom bar (Chat, Call, Parents).

The plan builds that in this order: **safety net → design system → low-risk screens first → navigation shell → Chat → Call → Paywall/Transcript/Parents → polish and QA → ship.** Screens that contain fragile logic (Call) come late, and only their visual layer is touched.

---

## 2. Ground Truth (confirmed by reading `dev` at commit `692d4ed`, Oct 10 2026)

| Area | Actual state |
|---|---|
| Routing | **No navigation library.** `App.tsx` switches on a `screen` state string (`home`, `chat`, `liveVoice`, `paywall`, `transcript`, `homework`, ...). This plan keeps it that way. |
| Styling | One `StyleSheet.create` per screen with hardcoded hex colors (blue `#1a73e8`, yellow `#FFD54F`). No shared theme, no fonts, no gradients library. |
| Home | Student list with an **ungated** inline "add student" row. Per student: `🎙️ Call`, `💬 Chat`, `📜 History`. Transcript and logout are behind the existing `ParentalGate`. |
| Parental gate | `components/ParentalGate.tsx`, a math question. Props: `visible`, `onSuccess`, `onCancel`. Used for transcript, logout and the paywall. |
| Chat | `ChatScreen` has a usage pill, photo-attach modal (camera or gallery) and a back button. No thread-list sidebar. |
| Call | `LiveVoiceScreen` (485 lines): voice call, `Camera` view, `handleToggleVideo`, `endButton`. Contains the frame loop and session logic. |
| Homework | `HomeworkScreen` is still routed in `App.tsx` but **nothing opens it** (the Scan button was removed in v6 Phase D). It is orphaned. |
| Dependencies | Expo `~57.0.4`, RN `0.86.0`, `react-native-vision-camera`, `react-native-purchases`, `expo-secure-store`, `expo-speech-recognition`. **Not installed:** react-navigation, nativewind, expo-font, expo-linear-gradient, react-native-safe-area-context. |
| App config | `userInterfaceStyle: "light"`, portrait. |
| Repo rule | `mobile/AGENTS.md`: *"Expo HAS CHANGED. Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code."* Every step below inherits this. |

**Not yet verified (checked in Phase 0, Step 0.3):** whether a read endpoint exists for (a) a child's thread list, (b) remaining Voice & Video minutes, (c) editing a child's name. The plan degrades gracefully if they don't, and never adds backend work.

---

## 3. What Changes vs. What Never Changes

| Changes (this plan) | Never changes (v6 guardrail, stays in force) |
|---|---|
| Colors, fonts, spacing, radii, shadows | `mobile/src/services/voiceSocket.ts` |
| Layout of every screen | `backend/**` (no backend edits in v7 UI phases; the only exception is the history, memory and cache work in `kidsko-master-plan-v7.1-memory-and-history.md`, on its own branch) |
| Navigation shell: bottom tabs and child switcher | `LiveVoiceScreen.tsx` hooks, effects, refs, handlers, the frame loop, audio logic |
| Empty states, loading states, suggestion chips | `services/chat.ts`, `services/homework.ts`, `services/billing.ts`, `services/api.ts` call contracts |
| Wording of labels (never of limits) | Tier numbers: Free 30 msgs / 3 uploads / 10 min per week; Premium 200 / 15 / 100 |
| Mascot and animation (visual only) | Call = Voice + Live Video. Homework photos = Chat only. |
| | ParentalGate behavior (math gate before Settings-type areas, paywall, logout, transcript) |

**Stop rule:** if a step seems to require editing anything in the right-hand column, stop and flag it. That is out of scope for v7.

### Prototype features deliberately NOT built

| Prototype feature | Decision | Why |
|---|---|---|
| 4-digit parent PIN, change PIN | **Not built** | New auth surface (storage, lockout, recovery). Keep the math gate. |
| Parent-set daily question limit | **Not built** | Conflicts with weekly tiers. |
| Study schedule, content filter toggles, daily report, limit alerts | **Not built** | No backend. Would be fake UI. |
| "AI Vision" tap-to-capture homework in Call | **Not built** | v6 puts homework photos in Chat; Call video is continuous. |
| Fake stats (23 questions, 7-day streak, 34m) | **Not built** | Never ship mock data. Show only data that exists. |
| Chat history drawer (ChatGPT-style, grouped by date, tap to continue) | **Built, see v7.1** | Needs the history endpoints from `kidsko-master-plan-v7.1-memory-and-history.md` (Phase 2); built in Step 4.5. |

---

## 4. How to Execute This Plan

- **One step = one branch commit.** Branch `ui/v7`. Commit message format: `ui(v7-P3.2): <what>`.
- **Tag first:** `git tag pre-v7` on the current `dev` head (Step 0.1). Rollback for anything is `git revert` of that step's commit, or reset to the tag.
- **After every step:** `npx tsc --noEmit` passes, the app launches on a real device, and the step's DoD is checked. Do not start the next step until it is.
- **Diff discipline for fragile files** (`LiveVoiceScreen.tsx`, `ChatScreen.tsx`): after the step, `git diff` must show changes only inside the `styles` object and JSX `style`/text props, plus new wrapper views. Any change inside a hook, effect, handler or service call means revert.
- **One step per agent session.** Paste only that step plus Sections 3 and 4.

---

## Phase 0 — Safety Net & Baseline (no visual change)

**Entry gate:** none. **Time:** 0.5 day.

### Step 0.1 — Branch and tag
- Create `ui/v7` from `dev`. Tag the starting commit `pre-v7`.
- **DoD:** `git tag` lists `pre-v7`; branch exists.

### Step 0.2 — Record the regression baseline (on a real device)
Walk the current app and write down pass/fail in `docs/v7-regression-checklist.md` (create it). This list is re-run after every phase.

1. Register, log in, log out (via gate).
2. Add a child. Open Chat, send a text message, get a reply.
3. In Chat, attach a photo from gallery and from camera; get an explanation.
4. Hit a free limit; confirm gate → paywall appears; paywall opens and closes.
5. Open Transcript behind the gate.
6. Start a voice call; talk; interrupt once; end call.
7. In a call, toggle video on and off twice; end call.
8. Take screenshots of every screen (kept as "before" images).

- **DoD:** checklist file committed with every row marked pass/fail on today's build. Any existing fail is recorded as **pre-existing**, so it is not blamed on v7.

### Step 0.3 — Verify the three open questions (read-only)
Search `backend/src/routes` and `mobile/src/services` and answer in writing at the top of the checklist file:
1. Is there an endpoint that lists a child's chat threads? *(Answered Oct 10: **no**. The history endpoints are built in v7.1 Phase 2.)*
2. Where does the Chat usage pill get its numbers, and does anything expose remaining Voice & Video minutes and plan status (`is_premium`) to the mobile app?
3. Is there an endpoint to rename or edit a child?

- **DoD:** three answers recorded. Consequences: (1) no → build v7.1 Phase 2 before Phase 4, and the drawer in Step 4.5. (2) minutes not exposed → Call card shows the plan limit text without a live count. (3) no → "Edit child" is omitted.

### Step 0.4 — Docs housekeeping
- Rename `docs/kidsko-v7.html.txt` → `docs/kidsko-v7-prototype.jsx`.
- Delete the duplicate extension-less `docs/kidsko-master-plan-v5`.
- Create `docs/archive/` and move v2, v3, v4, v5, `Discussion.md`, `suggestions.md`, both team-execution plans and the original ChatGPT-layout files into it. Keep v6, v7 and the SRS at top level.
- **DoD:** `docs/` top level has only v6, v7, the SRS/roadmap, the prototype and the checklist.

**Phase 0 Exit KPI:** ✅ The baseline checklist exists, every row has a recorded result, and `pre-v7` is tagged.

---

## Phase 1 — Design System Foundation (no screen changes yet)

**Entry gate:** Phase 0 complete. **Time:** 1 to 1.5 days.

> **Heads-up:** Step 1.1 adds native modules, so a **new EAS development build** is needed before testing. The app already uses a custom dev build (vision-camera), so this is a rebuild, not a new pipeline.

### Step 1.1 — Add dependencies (Expo 57 versions only)
Read the Expo v57 docs first. Install with `npx expo install` so versions match the SDK:
- `expo-font`, `@expo-google-fonts/nunito`
- `expo-linear-gradient`
- `react-native-safe-area-context`

Do **not** add nativewind, react-navigation, or an icon library.
- **DoD:** `npx expo install --check` is clean; a new dev build installs and launches on a device with no visible change.

### Step 1.2 — Theme tokens
Create `mobile/src/theme/` with `colors.ts`, `spacing.ts`, `typography.ts`, `index.ts`.

- **Colors** (from the prototype): coral `#FF6B6B`, orange `#FF9F43`, sun `#FFE66D`, sky `#4ECDC4`, mint `#95E1A3`, blue `#74B9FF`, purple `#A78BFA`, pink `#FD79A8`, green `#00B894`, background `#FFF8F0`, text `#2D3436`, subtext `#636E72`, border `#F0E6D3`, parent navy `#1E3A5F`.
- **Accessibility fix (do this now, not later):** white text on `#FF6B6B` is only about 2.8:1, which fails WCAG. Add a `coralStrong` (for example `#D94A4A`, about 5:1 against white) and use it for text and for any button with white labels. Keep the bright coral for fills and decoration.
- **Spacing:** 4-pt scale (4, 8, 12, 16, 24, 32). **Radii:** 12 / 16 / 24 / 32. **Shadows:** one soft card shadow and one button shadow, both Android-safe (`elevation`).
- **Typography:** Nunito 600/700/800/900; sizes for title, heading, body, caption. Minimum body size 14, minimum child-facing label 16.
- **DoD:** tokens compile; nothing imports them yet; no behavior change.

### Step 1.3 — Font loading
Load Nunito with `useFonts` in `App.tsx`. Keep the existing `checking` state until both fonts and the auth check are ready.
- **DoD:** cold start shows the loader, then the same first screen as before (fonts applied nowhere yet). No flash of the wrong font later.

### Step 1.4 — Shared components
Create `mobile/src/ui/` with small, prop-driven components: `Screen` (safe-area + cream background), `Button` (primary/secondary/ghost, min height 52), `Card`, `Pill`, `Mascot` (🦉 on a rounded gradient tile, sizes S/M/L, static for now), `ScreenHeader`, `EmptyState`.

- All sizes and colors come from the theme. Touch targets 44 pt minimum.
- Emoji stay as icons (no new library).
- **DoD:** components exist and render in a temporary dev-only style-guide screen reachable by setting `screen='styleguide'` in `App.tsx`, which is **deleted at Phase 7**. Check it on a small screen (about 360×640) and a large one.

**Phase 1 Exit KPI:** ✅ A theme, one font, and seven shared components exist and are verified on a real device; the production screens are unchanged.

---

## Phase 2 — Low-Risk Screens First (pilot the system)

**Entry gate:** Phase 1 complete. **Time:** 1 day. These screens have no fragile logic, so they prove the design system cheaply.

### Step 2.1 — Branded loading screen
Replace the plain spinner in the `checking` state with the owl mascot and wordmark on the cream gradient. No new route and no new buttons; the app still goes straight to login or home.
- **DoD:** cold start shows the branded loader, then proceeds exactly as before.

### Step 2.2 — Login and Register
Restyle both with the shared components: mascot header, rounded inputs, primary button, show/hide password, inline errors in a readable color.
- Only layout and styles change. All handlers, validation and API calls stay byte-for-byte.
- **DoD:** register → add child → logout → login works exactly as in the baseline checklist (rows 1 and 2); error states still show messages; the keyboard never covers the primary button on a small screen.

**Phase 2 Exit KPI:** ✅ Auth screens match the new look and the baseline rows for them still pass.

---

## Phase 3 — Navigation Shell (the structural change)

**Entry gate:** Phase 2 complete. **Time:** 2 to 3 days. This is the biggest UI-structure change, so it is split small.

**Design (keeps `App.tsx` state routing; no new navigation library):**

```
Authenticated app
 ├─ Header: child switcher chip (name + emoji) ── tap to switch active child
 ├─ Body (one of):  Chat tab │ Call tab │ Parents tab
 └─ Bottom bar:     💬 Chat   📞 Call   🔒 Parents
Full-screen (tab bar hidden): live call, paywall, transcript
```

### Step 3.1 — `TabBar` component and tab state
Add `TabBar` (three tabs, 80 pt tall including safe area, active state in `coralStrong`) in `mobile/src/ui/`. In `App.tsx`, replace the `home` screen with a `main` screen holding `tab: 'chat' | 'call' | 'parents'`.
- Keep `activeStudent` as the single source of truth for the selected child.
- **DoD:** tabs switch with placeholder bodies; tab bar is hidden on full-screen routes.

### Step 3.2 — Child switcher and first-run empty state
- Header chip shows the active child; tapping opens a small sheet listing children.
- **First-run rule (important):** a new parent has no child yet. If `students` is empty, the Chat tab shows an `EmptyState` with an inline "Add your first child" form, **ungated**, exactly as Home allows today. Adding a *second or later* child lives in Parents (Step 6.3), behind the gate.
- Auto-select the first child after load; if the selected child is removed, fall back to the first.
- **DoD:** a fresh account can reach Chat in two taps; an account with two children can switch; the selection survives switching tabs.

### Step 3.3 — Chat tab wiring
Render the existing `ChatScreen` inside the Chat tab for `activeStudent`. Remove its back button when embedded (prop `embedded`), keep everything else. Keep `initialThreadId`/`initialExplanation` props working.
- Switching child or tab must not lose an in-progress conversation unexpectedly: remount with a `key` of the child id only.
- **DoD:** baseline rows 2 and 3 pass inside the new shell. `onLimitReached` still triggers gate → paywall.

### Step 3.4 — Call tab wiring (landing card only)
The Call tab is a **landing card**, not a mode chooser:
- Mascot, "Talk to Kidsko", one big **Start Call** button, and a line of plan text (for example "Free plan: 10 Voice & Video minutes a week"). Show a live remaining count **only if** Step 0.3 found an existing source.
- A small hint: "You can turn your camera on during the call." No separate "AI Vision" option, no capture button.
- Start Call opens the existing `LiveVoiceScreen` full-screen with the tab bar hidden. `onBack` returns to the Call tab.
- **DoD:** baseline rows 6 and 7 pass; `onLimitReached` from a call still routes gate → paywall; ending a call returns to the Call tab, not to a stale screen.

### Step 3.5 — Parents tab wiring (gate first, content later)
Tapping Parents opens the existing `ParentalGate`; on success show a temporary list: History (existing `TranscriptScreen`), Upgrade (existing paywall route), Sign out. The tab lock resets when the user leaves the tab.
- Logout keeps its current gate behavior.
- **DoD:** baseline rows 1 (logout), 4 and 5 pass; leaving and re-entering Parents asks for the gate again.

### Step 3.6 — Retire the old Home and the orphaned Homework route
- Delete `HomeScreen.tsx` once nothing references it.
- `HomeworkScreen` has no entry point (orphaned since v6 Phase D). Remove the unused route from `App.tsx`; leave the file in place for now and note it in the PR so it can be deleted later if confirmed unused. Do **not** touch `services/homework.ts` or the backend route; Chat still uses them.
- **DoD:** `tsc` clean, no references to removed code, full baseline checklist passes.

### Step 3.7 — Android back button (add, small)
Hardware back: on full-screen routes go back to the tab shell; on the shell's non-Chat tabs go to Chat; on Chat exit the app. During a live call, back must trigger the same path as the End button (call `handleEnd`'s existing prop path through `onBack`), never leave a session running.
- **DoD:** back during a call ends it cleanly (check the backend session stops); back elsewhere behaves as described.

**Phase 3 Exit KPI:** ✅ The new shell replaces Home, and **every row of the baseline checklist passes** inside it.

---

## Phase 4 — Chat Restyle

**Entry gate:** Phase 3 complete, and v7.1 Phase 2 (history endpoints) deployed. **Time:** 2.5 to 3.5 days. Fragile-file rules apply (Section 4).

### Step 4.1 — Message list and input bar
Restyle bubbles (child: coral-strong with white text; Kidsko: white card with a mascot avatar), the typing indicator, and the input bar (rounded, large send button, mic and attach buttons ≥44 pt).
- **DoD:** diff touches only `styles` and JSX style/text props; baseline rows 2 and 3 pass.

### Step 4.2 — Empty state with suggestion chips
When the thread is empty show the mascot, a greeting using the child's name, and 4 static chips (for example "Why is the sky blue?", "Help me with fractions", "Tell me about dinosaurs", "📸 Help with my homework").
- Chips for questions **fill the input** (or send through the existing send path). They are real messages and count against the weekly limit like any other. The homework chip opens the existing attach modal.
- **DoD:** tapping a chip behaves exactly like typing that text; the usage count goes up by one; the homework chip opens the attach choices.

### Step 4.3 — Usage pill and limit copy
Restyle the pill. **Verify the wording is weekly** ("left this week"); fix any leftover "today" text. Do not change how the number is computed.
- **DoD:** the pill matches the backend count after a message and after a photo; Premium shows the Premium state.

### Step 4.4 — Attach modal and photo preview
Restyle the attach bottom sheet and the preview strip. Wording stays: camera or gallery. No logic change.
- **DoD:** baseline row 3 passes on both camera and gallery paths.

### Step 4.5 — Chat history drawer (ChatGPT-style)
Build exactly as specified in `kidsko-master-plan-v7.1-memory-and-history.md`, Phase 3 (Steps 3.1 to 3.7), in v7 styling:
- Hamburger in the Chat header opens a left drawer with a **New chat** button and the active child's chats grouped **Today / Yesterday / Previous 7 Days / Older**.
- Tapping a chat loads it and continues it (same thread id). The app still opens on a new empty chat, with a "Continue where you left off" card.
- Deleting a chat is behind the existing `ParentalGate`.
- Viewing history never changes the usage pill count.
- **DoD:** the v7.1 Phase 3 Exit KPI scenario passes on the emulator, and baseline rows 2, 3 and 4 still pass.

**Phase 4 Exit KPI:** ✅ Chat looks like the prototype, behaves identically, and shows real chat history that can be continued (baseline rows 2, 3, 4 pass plus the history rows).

---

## Phase 5 — Call Restyle (highest-risk file: visual layer only)

**Entry gate:** Phase 4 complete **and** the live-video device check from v6 (5+ minutes on a budget Android phone) either passed or consciously accepted as a known risk. **Time:** 1.5 to 2 days.

> `LiveVoiceScreen.tsx` is where the week of regressions happened. Every step here is judged by its diff. If the diff touches anything other than `styles` and JSX style/text props, revert it.

### Step 5.1 — Call layout
Restyle the in-call screen: dark-soft or cream background (pick one and keep it), large mascot, call timer in a pill, the End button as a big circular coral-strong button, the video toggle as a clear on/off pill, status text in plain words ("Listening…", "Kidsko is talking…") using the **existing** state values for text only.
- **DoD:** baseline rows 6 and 7 pass; no change to timing, audio or session behavior; the end button works at the first tap.

### Step 5.2 — Video preview container
Restyle the preview frame (rounded corners, border, placement). Do **not** change the camera component's props, the capture interval, or the frame code.
- **DoD:** video on/off ×2 works; frames still reach the backend (spot-check backend logs); no extra re-renders (watch for a changed frame rate).

### Step 5.3 — Notices and limit states
Restyle the network banner and the "time's up" state so they are readable and kind (large text, one clear action). The limit path still calls `onLimitReached`.
- **DoD:** forcing the limit still lands on gate → paywall.

### Step 5.4 — (Optional stretch) Mascot reacts to state
A small `Animated` scale or bounce on the mascot driven by the existing `voiceState` value, read-only. Use the native driver, no timers, no state set from inside animation callbacks.
- **Skip this step if** the call screen shows any new jank on the budget Android device. Polish is not worth a regression.
- **DoD:** 5+ minute call on the budget device shows no added stutter versus the Step 0.2 baseline.

**Phase 5 Exit KPI:** ✅ A 5-minute call with video toggled twice behaves exactly like the baseline, on both the primary and the budget device, and the diff review confirms only visual lines changed.

---

## Phase 6 — Paywall, Transcript and Parents Hub

**Entry gate:** Phase 5 complete. **Time:** 2 days.

### Step 6.1 — Paywall restyle
Restyle plan cards (Monthly $19.99, Annual $199 with a "best value" ribbon), feature list for parents, trust line ("No ads. Kids' data stays private."), and a clear cancel/back. **Numbers and copy of limits are unchanged** (Free 10 min / 30 msgs / 3 uploads; Premium 100 / 200 / 15, "Voice & Video minutes").
- Gate the "Sandbox Mode" simulated purchase behind `__DEV__` so it can never run in a production build. This is the only logic touch in this phase; it is a one-line guard.
- **DoD:** baseline row 4 passes; a production build (release mode) cannot trigger the simulated purchase.

### Step 6.2 — Transcript restyle
Card-per-conversation list with date headers, readable message bubbles, an empty state ("No chats yet"). Read-only; still behind the gate. Use the shared `cleanMessageText` from v7.1 Step 1.2 so raw `[STORAGE:...]` text never appears (shows "📷 Homework photo" instead).
- **DoD:** baseline row 5 passes; long conversations scroll smoothly.

### Step 6.3 — Parents hub (real features only)
Replace Step 3.5's temporary list with a designed hub, in `coralStrong`/navy parent styling:
- **Children:** list with an **Add another child** form (name only, as today).
- **Chat history** (the existing Transcript).
- **What Kidsko remembers** (v7.1 Step 4.5): the child's remembered name and facts with remove buttons, a "Remember things about <child>" switch, and a "Forget everything" button. Behind the gate. Add it once the v7.1 memory backend exists.
- **Plan:** shows Free or Premium and an Upgrade button (uses the existing paywall route).
- **Sign out** (gated as today).
- Add **Edit child** only if Step 0.3 found an existing endpoint.
- **Not included:** stats cards with invented numbers, PIN, schedules, filters, reports, alerts (see Section 3). If a real data source exists for "questions this week", it may be shown; otherwise leave it out.
- **DoD:** each item works end to end; no placeholder or fake number appears anywhere.

**Phase 6 Exit KPI:** ✅ Paywall, Transcript and Parents hub match the new look, contain no mock data, and baseline rows 1, 4 and 5 pass.

---

## Phase 7 — Polish, Accessibility & Full Regression

**Entry gate:** Phase 6 complete. **Time:** 1.5 to 2 days.

### Step 7.1 — Accessibility
- Every tappable element ≥ 44×44 pt; `accessibilityLabel` on icon-only buttons (mic, attach, end call, tabs).
- Contrast: body text ≥ 4.5:1 on its background; white-on-coral uses `coralStrong` everywhere. Check mint/sky text on cream and replace any failure.
- Test with the OS font size at maximum: no clipped buttons, no overlapping text.
- **DoD:** a written pass/fail table for the three checks above on one iOS and one Android device.

### Step 7.2 — Small-screen and notch pass
Run every screen at about 360×640 and on a tall notched phone. Fix overflow, covered buttons and keyboard overlap.
- **DoD:** screenshots of every screen on both sizes, no clipping.

### Step 7.3 — Performance on the budget Android device
Check cold start, tab switching and scrolling the transcript. If gradients or shadows cause jank, flatten them (solid fill, lower elevation) rather than adding libraries.
- **DoD:** tab switches feel instant; no dropped-frame stutter while scrolling; call stability equals the Step 0.2 baseline.

### Step 7.4 — Remove scaffolding and re-run everything
Delete the style-guide route and any unused imports/files. Run `tsc`, then the **entire** baseline checklist from Step 0.2, then the existing backend script `verifyPhaseFEndToEnd.ts` as a sanity check that the backend side is untouched.
- **DoD:** every checklist row passes or is marked pre-existing; `git diff pre-v7..ui/v7 -- backend/` is **empty** (or contains only the files listed in v7.1); `voiceSocket.ts` is unchanged.

**Phase 7 Exit KPI:** ✅ Zero regressions against the baseline, backend diff empty, accessibility table complete.

---

## Phase 8 — Ship the Redesign

**Entry gate:** Phase 7 complete. **Time:** 0.5 to 1 day plus review wait.

1. Merge `ui/v7` into `dev` (squash is fine; keep the tag `pre-v7`).
2. Build with EAS and install on both test devices; run the checklist once more on the **release** build, not only the dev client.
3. Capture the final screenshots for the store listings (they double as v7's "after" set).
4. Hand over to the v6 launch track (below).

**Phase 8 Exit KPI:** ✅ A release build with the new UI passes the full checklist on a real device.

---

## Parallel Track B — Non-UI items (separate branches, not part of v7)

Do these on their own branches so a UI revert never drags them along. None of them blocks Phases 0 to 8 except where noted.

| Item | Why | Size |
|---|---|---|
| Drop `weekly_live_snapshots_used` and rename `daily_*` columns to `weekly_*` (migration plus code) | Leftovers from the removed snapshot feature and the daily→weekly change; cheaper to do before launch | 0.5 day, touches backend |
| Close live-video risk: budget-Android 5-minute test; move from the `capturePhoto()` 2.5 s loop to a frame processor if it stalls | The one known technical risk in Call | 1 to 3 days |
| Account deletion endpoint and in-app flow | Required by Apple for store submission | 1 day |
| Minimal Settings (profile, password) | Fills the prototype gap; place it inside the Parents hub | 1 to 2 days |
| 10-prompt jailbreak safety test, privacy policy, Terms | Required for Kids Category listing | 1 to 2 days |
| Phase 7 of v6: billed Gemini key, RevenueCat production setup, store listings, 5 test families | Launch | per v6 |

---

## Risk Register

| Risk | Mitigation |
|---|---|
| UI work breaks the stable call | Section 3 do-not list; diff discipline; Phase 5 gated and last among behavior-adjacent phases; optional animation step may be skipped |
| New native modules break the dev build | Step 1.1 installs via `npx expo install` only, then a fresh dev build is verified before any screen changes |
| Navigation shell loses state (conversation, selected child) | Step 3.2 and 3.3 define keys and the single `activeStudent` source of truth; baseline rows re-run after Phase 3 |
| First-time users get blocked behind the parental gate before they can add a child | First-run empty state with an ungated add form (Step 3.2) |
| Prototype scope creep (PIN, schedules, filters, fake stats) | Explicit "NOT built" table in Section 3; Step 6.3 forbids invented numbers |
| Coral/white contrast fails accessibility | `coralStrong` introduced in Step 1.2, audited in Step 7.1 |
| Gradients or shadows are slow on budget Android | Step 7.3 measures; fallback is solid colors, not new libraries |
| Android back button leaves a live session open | Step 3.7 routes back through the same end-call path |

---

## Definition of Done for v7

- Every screen uses the shared theme and components; no hardcoded hex remains in screen files (search for `#` in `mobile/src/screens` returns only theme imports).
- Navigation is Chat / Call / Parents with a child switcher; Home is gone.
- The full baseline checklist passes on a **release** build on one iOS and one budget Android device.
- `backend/**` and `voiceSocket.ts` are unchanged versus `pre-v7`, except the files listed in v7.1 (history, memory, cache fix). Call code (`LiveVoiceScreen.tsx`, `voiceSocket.ts`, `voiceSocketServer.ts`, `geminiLive.ts`) is unchanged.
- No mock data, no PIN, no fake stats anywhere in the app.

---

## Bottom Line

v7 is a reskin and a navigation upgrade, executed in the order that protects what already works: record a baseline, build the design system, prove it on the easy screens, change the navigation shell, then restyle Chat, Call and the parent surfaces, with every step small enough to review and revert. The next big decision after this plan is not visual: it is closing the live-video stability risk and the store-readiness items in Track B.