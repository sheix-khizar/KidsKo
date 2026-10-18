> Status: current

# Kidsko.ai — Master Plan v8: Clean and Polish

**One plan, four jobs, in this order:**
1. **Close v7** (the last fixes and real-device evidence).
2. **Clean the docs** (folder structure).
3. **Clean the app** (remove bad code, dead code, drift).
4. **Make it look and feel like the final prototype** (gradients, Nunito, animation, splash).

Start this plan **after the v7 combined implementation guide is finished** (all 12 stages in code). It replaces two earlier drafts: `kidsko-master-plan-v8-visual-parity.md` and `kidsko-docs-cleanup-plan.md`. Do not follow those separately; everything from them is merged here.

**Rules that stay in force from v7 and v7.1:** the call screen is visual only; `voiceSocket.ts`, `voiceSocketServer.ts` and `geminiLive.ts` are never touched; the parental gate is a maths question with no bypass; no mock data ships.

---

## 0. How to use this plan

- Work **top to bottom**. Each phase has an entry gate (what must be true first) and a Definition of Done (DoD).
- **One step = one commit.** Message format: `v8(<phase>.<step>): <what>`. Roll back any step with `git revert`.
- After **every** step: `npx tsc --noEmit` in `mobile/` (and `backend/` if touched) passes.
- After every **visual** step: run the app on a **real phone**, not only the emulator.
- If a step seems to need a logic change that is not listed, **stop and ask**.
- Before using any Expo API, read the SDK 57 docs (`mobile/AGENTS.md`).

### Branches

| Branch | Used for | Based on |
|---|---|---|
| `fix/v7-close-out` | Phase 1 (logic fixes, the only phase that changes logic) | `dev` |
| `chore/docs-cleanup` | Phase 2 | `dev` after Phase 1 |
| `chore/app-cleanup` | Phase 3 | `dev` after Phase 2 |
| `ui/v8-parity` | Phases 4 to 9 (visual only) | `dev` after Phase 3 |

Tag `pre-v8` on the clean `dev` head **after Phase 3**, before any visual work.

---

## 1. Why the app does not look like the prototype

Found by comparing the code with the screenshots in `docs/baselines/v7/` and `docs/design/reference-screens/`.

| # | Cause | Evidence | Visible effect |
|---|---|---|---|
| 1 | **Gradients are fake.** `mobile/src/ui/LinearGradient.tsx` fills one flat colour (first stop only). | The stub; the chat hero is flat coral in the app screenshot. | Splash, buttons, headers, mascot tile and call screen are flat. |
| 2 | **No animation.** No `Animated` use in `mobile/src`; the prototype has 12 keyframes. | `grep Animated` returns nothing. | Everything feels static and abrupt. |
| 3 | **Nunito is not applied.** Fonts load, but screens use `fontWeight`, and React Native does not choose a Nunito weight from it. | 8 `fontFamily` uses (all in `typography.ts`) against about 106 `fontWeight` uses. | Text looks generic, not rounded. |
| 4 | **The splash is a spinner**, not the prototype's welcome screen (stars, bouncing owl, two buttons). | `App.tsx` loading view. | Wrong first impression. |
| 5 | **No native splash setup.** | No `expo-splash-screen` use. | A white or black flash on launch. |
| 6 | **Shadows are flat.** The prototype uses large coloured glows; Android `elevation` is small and grey. | Style files. | Buttons and cards look flat. |
| 7 | **Spacing, radii and weights drift** from screen to screen. | Repeated hex and size values. | A "not quite right" feeling. |

Fixing 1 to 3 gives most of the visible improvement. Do them first.

---

## 2. What we copy from the prototype, and what we do not

**Copy the look:** colours, gradients, radii, shadows, type, spacing, motion.

**Never copy the demo content or features** (the v7 rule "never ship mock data" applies):

| Prototype element | Decision |
|---|---|
| "Continue with Google" button | **Do not build.** No Google sign-in exists. |
| 4-digit parent PIN, change PIN | **Do not build.** The gate stays the maths question. |
| Sample child ("Aisha Khan"), sample chats | **Do not build.** Use real children and real history. |
| Stats cards, streak, topic-mastery bars, daily report, schedules, filters, alerts | **Do not build.** No real data behind them. |
| "AI Vision" tap-to-capture mode | **Do not build.** Call is Voice + Live Video in one session. |
| Daily question limits | **Do not build.** Limits are weekly. |
| Phone frame, notch, status bar, page header and pills | **Not part of the app.** |

The Call landing is **one** card ("Start Call", voice plus optional camera), styled like the prototype's dark call home.

---

## Phase 1 — Close v7 (about 1.5 days)

**Entry gate:** the v7 combined guide's 12 stages are merged in `dev`.
**Branch:** `fix/v7-close-out`. This is the **only** phase that changes logic, so each fix is its own commit and gets its own test.

### Step 1.1 — Restore `dev` to the clean v7 code
The commit `bb0cbe4` ("modernize") on `dev` contains problems that must not survive:
- a hardcoded `1234` bypass in `ParentalGate.tsx`;
- a fake "Continue with Google" button that fills dummy credentials;
- invented numbers in the Parents hub ("42m", "18", "5", "4 days", topic bars);
- a changed `ChatScreen` send path that loses typed text when sending fails;
- a flat stub for `LinearGradient`.

The branch `ui/v8-polish` (`0adf325`) already restores clean v7 code. Merge it into `dev` (or reset `dev` to it) and **reword its commit message** to "restore v7 UI after modernize commit; add v8 baseline screenshots" (the current title says "complete v8 polish", which is wrong).
- **DoD:** `grep -rnE "1234|password123|Continue with Google|parent@example" mobile/src` returns nothing; the Parents hub has no hardcoded numbers; `tsc` passes.

### Step 1.2 — Small logic fixes found in the audit
Each is a separate commit.

| # | Fix | Where |
|---|---|---|
| a | A stored name that fails validation must **not** silently clear the old name; reject the request instead. | `backend/src/routes/students.ts`, `lib/studentMemory.ts` |
| b | If loading "What Kidsko remembers" fails, show an error with Retry; never show "Active" with no data. | `mobile/src/components/ParentsHub.tsx` |
| c | Cap memory extraction (for example once per thread per minute, or pre-filter "I'm stuck"-type phrases) so it does not call Gemini on every "I'm …". | `backend/src/routes/chat.ts`, `lib/studentMemory.ts` |
| d | Confirm the real name of the `usage_events` check constraint; if it is not `usage_events_event_type_check`, fix the migration so `'memory'` events log. | `backend/migrations/` |
| e | Decide on non-Latin names and facts (Urdu): either allow them in the filter or record "English only for now" in the SRS. | `lib/studentMemory.ts` |
| f | Add one real test per fix; replace the two backend tests that re-implement the logic with ones that call the route or helper. | `backend/tests/` |

- **DoD:** every item has a commit, a test and a line in the checklist.

### Step 1.3 — Real-device evidence for v7 (needs the phones, about half a day)
- On a budget Android phone: a **5-minute call with video toggled twice**, recorded; note any stutter.
- Build an EAS release build; run `docs/checklists/v7-regression-checklist.md` on **one Android and one iPhone**, with screenshots or notes, not only "PASS".
- Test a notched phone and a gesture-navigation phone for safe-area problems (feeds Step 5.5).
- **DoD:** the checklist rows carry dates, devices and evidence. If the call stutters, **stop**: v8 does not start until the baseline is stable.

### Step 1.4 — Merge and tag
Merge `fix/v7-close-out` into `dev`. Tag it `v7-final`.

---

## Phase 2 — Clean the docs (about 1 hour)

**Entry gate:** Phase 1 merged.
**Branch:** `chore/docs-cleanup`. Use `git mv` so history is kept; one commit per step; no content edits in a move commit.

### Step 2.1 — What is wrong today

| Problem | Where | Fix |
|---|---|---|
| Applied `.patch` files committed | `docs/Patch/` | Delete |
| Scratch files mixed with baselines | `docs/v8/app/` (`temp.png`, `current.png`, `screen_check.png`, `ui.xml`) | Delete |
| Prototype folder also holds a plan | `Prototype-Final-UI-UX/Kidsko-UI-UX-implementation-plan.md` | Move to archive (replaced by this plan) |
| Plans, reports and checklists all in the root | `docs/*.md` | Group by type |
| Mixed names (`Kidsko-`, `kidsko-`, `v7-`), CamelCase folder, a typo (`kidskko`) | everywhere | Lowercase kebab-case |
| No index | none | Add `docs/README.md` |

### Step 2.2 — Target structure

```
docs/
├── README.md                    index: what each folder is, which plan is current
├── plans/
│   ├── current/
│   │   ├── master-plan-v8-clean-and-polish.md      <- this file
│   │   ├── master-plan-v7.md
│   │   ├── master-plan-v7.1-memory-and-history.md
│   │   └── implementation-guide-v7-combined.md
│   └── product/
│       ├── master-plan-v6.md
│       └── full-srs-and-roadmap.md
├── reports/
│   └── 2026-10-11-v7-progress-report.md            dated, never edited
├── checklists/
│   ├── v7-regression-checklist.md
│   └── v8-device-test-sheet.md                     added in Phase 9
├── design/
│   ├── prototype/kidsko-final.html                 the approved prototype
│   ├── reference-screens/                          prototype screenshots (target look)
│   └── v7-prototype.jsx
├── baselines/
│   ├── v7/                                         screenshots of the real app before v8
│   └── v8/                                         filled in Phase 9, plus diff-log.md
└── archive/
    ├── plans/      master-plan-v2..v5, team-execution-plan(+v2), ui-ux-implementation-plan-draft
    ├── prototypes/ chatgpt-layout.html
    └── raw/        discussion.md, suggestions.md, kidsko-chat-and-plan.docx
```

`design/` is the **target**; `baselines/` is what the app **really** looks like. The v8 parity check compares the two by file name.

### Step 2.3 — Commands (run from the repo root)

```bash
git checkout dev && git pull
git checkout -b chore/docs-cleanup

# 1) delete what should not be committed
git rm -r docs/Patch
git rm docs/v8/app/temp.png docs/v8/app/current.png docs/v8/app/screen_check.png docs/v8/app/ui.xml
git commit -m "v8(2.3a): remove applied patches and scratch screenshots"

# 2) plans, reports, checklists
mkdir -p docs/plans/current docs/plans/product docs/reports docs/checklists
git mv docs/kidsko-master-plan-v7.md                       docs/plans/current/master-plan-v7.md
git mv docs/kidsko-master-plan-v7.1-memory-and-history.md  docs/plans/current/master-plan-v7.1-memory-and-history.md
git mv docs/kidsko-implementation-guide-v7-combined.md     docs/plans/current/implementation-guide-v7-combined.md
git mv docs/kidsko-master-plan-v6.md                       docs/plans/product/master-plan-v6.md
git mv docs/kidsko-full-srs-and-roadmap.md                 docs/plans/product/full-srs-and-roadmap.md
git mv docs/kidsko-v7-progress-report.md                   docs/reports/2026-10-11-v7-progress-report.md
git mv docs/v7-regression-checklist.md                     docs/checklists/v7-regression-checklist.md
# copy this file into docs/plans/current/master-plan-v8-clean-and-polish.md
git commit -am "v8(2.3b): group plans, reports and checklists"

# 3) design and baselines
mkdir -p docs/design/prototype docs/design/reference-screens docs/baselines/v7 docs/baselines/v8
git mv docs/Prototype-Final-UI-UX/kidsko-final.html docs/design/prototype/kidsko-final.html
git mv docs/kidsko-v7-prototype.jsx docs/design/v7-prototype.jsx
for f in docs/v8/proto/*.png; do git mv "$f" "docs/design/reference-screens/$(basename "$f" | tr '_' '-')"; done
for f in docs/v8/app/*.png;   do git mv "$f" "docs/baselines/v7/$(basename "$f" | tr '_' '-')"; done
touch docs/baselines/v8/.gitkeep
git add -A && git commit -m "v8(2.3c): separate design references from app baselines"

# 4) archive
mkdir -p docs/archive/plans docs/archive/prototypes docs/archive/raw
git mv docs/Prototype-Final-UI-UX/Kidsko-UI-UX-implementation-plan.md docs/archive/plans/ui-ux-implementation-plan-draft.md
for n in 2 3 4 5; do git mv docs/archive/kidsko-master-plan-v$n.md docs/archive/plans/master-plan-v$n.md; done
git mv docs/archive/kidsko-team-execution-plan.md    docs/archive/plans/team-execution-plan.md
git mv docs/archive/kidsko-team-execution-plan-v2.md docs/archive/plans/team-execution-plan-v2.md
git mv docs/archive/kidsko-chatgpt-layout.html       docs/archive/prototypes/chatgpt-layout.html
git mv docs/archive/Discussion.md                    docs/archive/raw/discussion.md
git mv docs/archive/suggestions.md                   docs/archive/raw/suggestions.md
git mv "docs/archive/kidskko chat and plan.docx"     docs/archive/raw/kidsko-chat-and-plan.docx
git commit -am "v8(2.3d): tidy archive"
```

### Step 2.4 — Fix the links (one commit)
No code in `mobile/` or `backend/` mentions `docs/`, so the app is unaffected. These docs do, and must be updated:

| File | Old reference | New reference |
|---|---|---|
| `plans/current/master-plan-v7.md` | `docs/kidsko-v7.html.txt`, `docs/kidsko-v7-prototype.jsx`, `docs/v7-regression-checklist.md`, `docs/archive/`, `docs/kidsko-master-plan-v5` | `docs/design/v7-prototype.jsx`, `docs/checklists/v7-regression-checklist.md`, `docs/archive/plans/` (drop the `.html.txt` mention if that file no longer exists) |
| `plans/current/master-plan-v7.1-memory-and-history.md` | `docs/v7-regression-checklist.md` | `docs/checklists/v7-regression-checklist.md` |
| `plans/current/implementation-guide-v7-combined.md` | same as above | same as above |
| `reports/2026-10-11-v7-progress-report.md` | `docs/archive/` | `docs/archive/plans/` |
| `archive/plans/ui-ux-implementation-plan-draft.md` | `docs/v8/proto/`, `docs/v8/app/`, `docs/v8/diff-log.md` | `docs/design/reference-screens/`, `docs/baselines/v7/`, `docs/baselines/v8/diff-log.md` |

Add a status line at the top of every plan: `> Status: current | superseded by v8 | archived`. v7 and v7.1 are "closed, see v8"; v6 is "product plan, still valid"; everything in `archive/` is "archived, do not follow".

Add `docs/README.md`:

```md
# Kidsko.ai documentation

| Folder | What is in it | Edit it? |
|---|---|---|
| plans/current/ | Plans being worked on (v8, and closed v7 / v7.1) | Yes |
| plans/product/ | Product and launch plan, SRS and roadmap | Rarely |
| reports/ | Dated progress reports and audits | No: add a new dated file |
| checklists/ | Regression and device test sheets | Yes: record date and device |
| design/ | Approved prototype and reference screens (the target look) | Only when design changes |
| baselines/ | Screenshots of the real app per milestone (v7, v8) | Add only |
| archive/ | Old plans and raw chats, history only | No |

Which plan do I follow? plans/current/master-plan-v8-clean-and-polish.md
Conventions: lowercase-kebab-case names; reports start with YYYY-MM-DD-;
screenshots PNG, 720 px wide, under 300 KB; no .patch files, scratch screenshots or UI dumps in git.
```

Add to `.gitignore`: `*.patch`, `docs/**/temp*.png`, `docs/**/*.xml`.

### Step 2.5 — Verify and merge
```bash
grep -rnE "docs/(v8|Patch|Prototype-Final-UI-UX|kidsko-|v7-regression)" docs mobile/src backend/src README* | grep -v "docs/archive/"
ls docs     # only README.md and the folders in 2.2
```
The grep prints nothing. The PR diff shows renames, not delete plus add.

- **DoD:** `docs/` matches the structure in 2.2; every plan has a status line.

---

## Phase 3 — Clean the app code (about 1 day)

**Entry gate:** Phase 2 merged. **Branch:** `chore/app-cleanup`. **No behaviour changes**: removals and renames only. Run `tsc` after each commit and smoke-test the app once at the end.

| Step | Cleanup | Where | How to check |
|---|---|---|---|
| 3.1 | Remove dead state `scanThreadId` and `scanExplanation` | `mobile/App.tsx` | `tsc`; no references left |
| 3.2 | Remove the orphaned `HomeworkScreen.tsx` if nothing imports it (it carries 20 hardcoded hex colours) | `mobile/src/screens/` | `grep -rn HomeworkScreen mobile` shows no import. If the route is still used, keep it and restyle it in Step 8.x instead |
| 3.3 | Remove unused style keys (for example an unused `loading` style) | screens | `tsc` plus a quick scan |
| 3.4 | Remove the unused `expo-camera` dependency if nothing imports it | `mobile/package.json` | `grep -rn "expo-camera" mobile/src` shows nothing; run `npx expo install --check` |
| 3.5 | Remove the leftover scratch temp screen and any style-guide leftovers | `mobile/src` | grep for "StyleGuide", "TestMotion" |
| 3.6 | Remove leftover snapshot and `daily_*` columns **only if** the v6 Track B plan says so; otherwise leave them and write a one-line note | `backend/` | Do not start a migration here; mark as Track B |
| 3.7 | Delete `console.log` leftovers in screens and services (keep real error logging) | `mobile/src` | `grep -rn "console.log" mobile/src` |
| 3.8 | Confirm `.env` files are not tracked; only `.env.example` | repo | `git ls-files \| grep "\.env"` shows only the examples |
| 3.9 | One naming pass for files created in v7/v7.1 (`threads.ts`, `groupThreads.ts`, `messageText.ts`) so imports are consistent | `mobile/src` | `tsc` |

Then:
- Run the app once through every screen (the 5-minute regression run from the checklist).
- Merge into `dev`. Move the tag: `git tag -f pre-v8 && git push -f origin pre-v8`.
- **DoD:** `tsc` passes on both apps; no dead imports; `git diff pre-v7..HEAD --stat` shows no change to `voiceSocket.ts`, `voiceSocketServer.ts` or `geminiLive.ts`.

---

## 4. Guardrails for all visual work (Phases 4 to 9)

1. **Visual only.** If a step needs a logic change, stop and ask.
2. **`LiveVoiceScreen.tsx` is strictly visual:** only `styles`, JSX style/text props, and **new child components added to the JSX** (wave bars, pulse ring, live dot). No change to hooks, refs, effects, the frame loop, socket handlers or service calls.
3. **`ChatScreen.tsx`:** logic stays limited to the four v7 changes (cleanMessageText, `embedded`, chips wiring to the **existing** handlers, history drawer). Motion is added as wrapper components. `handleSend` keeps restoring the typed text when a send fails.
4. **`ParentalGate`:** visual changes only; the answer check stays the maths answer.
5. **Animate only `transform` and `opacity`, with `useNativeDriver: true`.** Never width, height, top or left. Respect Reduce Motion.
6. **Each animation is its own small component** in `mobile/src/ui/motion.tsx`.
7. **No hardcoded colours in screens**; use theme tokens. (`LiveVoiceScreen` stays exempt, as in v7.)

---

## 5. Prototype values to lift into the theme

From `docs/design/prototype/kidsko-final.html`. Put them in `mobile/src/theme/` once; screens only reference them.

**Colours:** coral `#FF6B6B`, orange `#FF9F43`, sun `#FFE66D`, sky `#4ECDC4`, mint `#95E1A3`, blue `#74B9FF`, purple `#A78BFA`, pink `#FD79A8`, green `#00B894`, background `#FFF8F0`, text `#2D3436`, subtext `#636E72`, border `#F0E6D3`, parent navy `#1E3A5F`, parent blue `#2980B9`. Keep `coralStrong` (`#D94A4A`) for **white text on coral** (contrast).

**Gradients:**

| Name | Stops | Angle |
|---|---|---|
| primary | `#FF6B6B` → `#FF9F43` | 135° |
| splash | `#FFF0F5` → `#FFF8F0` → `#F0FFF4` | 160° |
| callDark | `#1A1A2E` → `#16213E` → `#0F3460` | 160° |
| parents | `#1E3A5F` → `#2980B9` | 135° |
| teal | `#4ECDC4` → `#74B9FF` | 135° |

**Shapes and shadows:**
- Main button: radius 24, padding 18, text 18 / 900, shadow `0 8px 28px rgba(255,107,107,.45)`.
- Ghost button: radius 24, padding 16, text 15 / 800, background `rgba(255,107,107,.08)`, border 2 `rgba(255,107,107,.25)`.
- Form field: radius 16, border 2 `#F0E6D3`, background `#FFF8F0`, padding 14×16, text 15 / 600; focus border coral.
- Mascot tile: splash 120 (radius 40), call 100 (radius 36), shadow `0 12px 40px rgba(255,107,107,.4)`.
- Bottom nav: height 80, border-top 2 `#F0E6D3`; active tab has a coral tint pill and a 20×3 coral dot.
- Drawer: width 295, 260 ms, easing `(.4, 0, .2, 1)`; overlay `rgba(0,0,0,.45)`.
- Toggle: 46×26, mint when on.
- Splash title: 42 / 900, letter-spacing -1, `.ai` in coral.

**Type:** Nunito via `fontFamily` (`Nunito_600SemiBold`, `_700Bold`, `_800ExtraBold`, `_900Black`).

**Motion:**

| Prototype keyframe | Component | Behaviour |
|---|---|---|
| `owlBounce` | `Bounce` | Loop 3 s, ease in-out: up 12 px, rotate ±3° |
| `orbPulse` | `Pulse` (orb) | Loop 3 s: scale 1 → 1.2, opacity .8 → .4 |
| `ringPulse` | `Pulse` (ring) | Loop: opacity .5 → 1, scale 1 → 1.05 |
| `pulse` | `Pulse` | Loop 1.5 s: scale 1 → 1.08 |
| `fadeSlideIn` | `FadeSlideIn` | Once: opacity 0 → 1 and 10 px up, optional `delay` |
| `typingDot` | `TypingDots` | Three dots hop 5 px, staggered |
| `waveBar` | `WaveBars` | N bars loop `scaleY` 1 → .25 with different delays |
| `loadBar` | `LoadBar` | `scaleX` 0 → 1 from the left edge (not width) |
| `liveDot` | `LiveDot` | Loop opacity 1 → .3 |
| `starFloat` | `FloatStar` | Alternate: up 8 px, rotate 15°, 2 to 3 s |
| `shimmer` | `Shimmer` (optional) | Skeleton sweep |
| tap | `PressScale` | Scale .97 on press, short spring |
| `.screen` fade | keyed `FadeSlideIn` | 220 ms cross-fade |

**CSS that React Native cannot do:**

| CSS | Substitute |
|---|---|
| `filter: blur()` orbs | Large low-opacity circles (no blur) |
| `backdrop-filter: blur()` | Translucent fill `rgba(255,255,255,.07)` |
| coloured `box-shadow` | `boxShadow` style if SDK 57 supports it; `shadowColor` on iOS; `elevation` only as an Android fallback |
| `transition` | `Animated.timing` |

---

## Phase 4 — Baseline and difference log (0.5 day)

**Entry gate:** Phase 3 merged and `pre-v8` tagged. Create the branch `ui/v8-parity`.

### Step 4.1 — Baseline screenshots
On a real phone, screenshot: splash, register, login, chat (empty and with messages), history drawer, call landing, in-call, Parents hub, paywall, transcript, parental gate. Open the prototype at 390 px wide and capture the same screens. Save to `docs/baselines/v7/` and `docs/design/reference-screens/` with **identical file names**.
- **DoD:** every screen has a pair.

### Step 4.2 — Difference log
Write `docs/baselines/v8/diff-log.md`: one row per element, *what is wrong*, and a priority (P1 visible at first glance, P2 noticeable, P3 minor). The six root causes in Section 1 must appear as rows.

---

## Phase 5 — Foundations: gradients, font, tokens, shadows, safe areas (1 to 1.5 days)

**Entry gate:** Phase 4 done. This phase gives the biggest visible change.

### Step 5.1 — New dev client
`expo-linear-gradient` is installed but its native module is missing from the current dev APK. Run `npx expo install --check`, then build a new development client (`eas build --profile development --platform android`, plus iOS if you test on iPhone) and install it.
- **DoD:** the app opens with no "view manager" error.

### Step 5.2 — Real gradient
Replace the stub in `mobile/src/ui/LinearGradient.tsx` with a re-export of `expo-linear-gradient`.
- **DoD:** `Button`, `Mascot` and any gradient header show real two-colour gradients.

### Step 5.3 — Apply Nunito everywhere
Add a helper in `mobile/src/theme/typography.ts` that maps a weight (`600/700/800/900`) to the matching Nunito `fontFamily`. In every `StyleSheet`, replace `fontWeight` with the helper's `fontFamily`. This is a mechanical one-pass change: use a script, then **review the whole diff**. Never set both `fontFamily` and `fontWeight` (Android then picks a faux-bold).
- **DoD:** screenshots show rounded Nunito text; `grep -rn "fontWeight" mobile/src` returns only intentional exceptions.

### Step 5.4 — Theme tokens
Add the gradients, shadows, radii and button/field specs from Section 5 to the theme, with a `shadows.glow(color)` helper (use `boxShadow` where supported, otherwise `shadowColor` and `elevation`).
- **DoD:** nothing in a screen defines its own gradient colours.

### Step 5.5 — Safe areas
Switch `Screen.tsx` and `TabBar` to `react-native-safe-area-context` (wrap the app in `SafeAreaProvider`). The built-in `SafeAreaView` is deprecated and does nothing on Android. Remove the `StatusBar.currentHeight / 2` guess.
- **DoD:** correct top and bottom padding on a notched phone and a gesture-navigation phone.

**Phase 5 exit:** with no animation yet, the static look of the splash, buttons, headers and text is close to the prototype. Take screenshots and compare before going on.

---

## Phase 6 — Motion kit (1 day)

**Entry gate:** Phase 5 done. Everything lives in `mobile/src/ui/motion.tsx`, exported from `ui/index.ts`.

| Step | Item |
|---|---|
| 6.1 | `useReduceMotion()` using `AccessibilityInfo.isReduceMotionEnabled` |
| 6.2 | `Bounce`, `Pulse` (orb, ring, plain), `FloatStar` |
| 6.3 | `FadeSlideIn` (with `delay`) and a keyed screen cross-fade wrapper |
| 6.4 | `TypingDots`, `WaveBars`, `LoadBar` (scaleX from the left), `LiveDot` |
| 6.5 | `PressScale` wrapper for pressables |
| 6.6 | `Shimmer` (optional) |

- Every component renders a static version when Reduce Motion is on.
- Build a temporary test screen to check each on a real phone, then **delete it** before merging.
- **DoD:** smooth on the budget Android phone, no dropped frames, no timers running after unmount.

---

## Phase 7 — Splash and welcome (1 day)

**Entry gate:** Phase 6 done.

### Step 7.1 — Native splash
Set the native splash background to `#FFF8F0` with the owl/logo image in `app.json`. Use `expo-splash-screen` (`preventAutoHideAsync`) so it stays until fonts and the auth check finish.
- **DoD:** no white or black flash on launch.

### Step 7.2 — Animated loading view
Rebuild the loading view in `App.tsx` to match the prototype splash: the splash gradient, two soft corner circles (no blur), a `Bounce` owl tile (120, radius 40, glow), the 42 / 900 "Kidsko.ai" title, the tagline, three `FloatStar`s and a `LoadBar`. Show it for at least about 1.2 s.
- **DoD:** side by side with `docs/design/reference-screens/splash.png` they look the same.

### Step 7.3 — Welcome screen for signed-out users
Add a `welcome` route: the splash design plus "🚀 Let's Start Learning!" (goes to Register) and "I already have an account" (goes to Login). Signed-out users start here; signed-in users skip it. This adds one route to `App.tsx` and no logic beyond navigation.
- **DoD:** a signed-out cold start shows the welcome screen; both buttons navigate correctly.

---

## Phase 8 — Screen by screen (2 to 3 days)

**Entry gate:** Phase 7 done. One screen per commit. The prototype screenshot is the target.

| Step | Screen | Work |
|---|---|---|
| 8.1 | **Register and Login** | Gradient header with mascot, rounded fields with focus colour, main and ghost buttons, `FadeSlideIn` staggered 60 ms, `PressScale`. **No Google button.** |
| 8.2 | **Chat** | Topbar, greeting hero with the primary gradient, prompt cards (chips wiring unchanged), `FadeSlideIn` for new bubbles, `TypingDots` while the AI replies, pill input bar, `Pulse` on the mic while listening. |
| 8.3 | **History drawer** | Slides from the left (295 wide, 260 ms, the prototype easing) with a fading overlay; same data as today. |
| 8.4 | **Tab bar and shell** | Coral tint pill and dot on the active tab; short fade when content changes. |
| 8.5 | **Call landing** | Dark call gradient, soft orb, one "Talk to Kidsko!" card (voice plus optional camera), plan text from real billing state. |
| 8.6 | **In-call (visual only)** | `Pulse` orb and ring around the avatar, `WaveBars`, `LiveDot` as **new child components in the JSX**. No hook, ref, effect or frame-loop change. |
| 8.7 | **Parents hub** | Navy gradient header and card styling. Content stays real: children, add child, "What Kidsko remembers", chat history, plan, sign out. **No stats, no PIN.** |
| 8.8 | **Paywall and Transcript** | Gradient plan cards, ribbon, `FadeSlideIn` stagger; transcript cards. Numbers and copy unchanged. |
| 8.9 | **Lists** | Staggered `FadeSlideIn` for the first 8 rows only (history, transcript, memory chips). |
| 8.10 | **Homework screen** (only if Step 3.2 kept it) | Same tokens, no hardcoded colours. |

**DoD for each:** the screen matches its prototype screenshot; its v7 regression row still passes; for 8.6 the `git diff` shows only added JSX and styles.

### Transitions (same phase, 0.5 day)
- 8.11 Cross-fade between top-level screens (welcome, register, login, main).
- 8.12 Modals (parental gate, attach sheet) use fade plus slide-up.
- 8.13 Confirm `ChatScreen` stays mounted across tab changes and nothing remounts it.
- **DoD:** no instant swaps; switching tabs and back keeps the conversation.

---

## Phase 9 — Parity pass, performance, release (1.5 days)

1. **Parity pass:** work through `diff-log.md` from P1 down. Every P1 and P2 row is fixed or marked "accepted" with a reason. Save the final screenshots to `docs/baselines/v8/` with the same names as `docs/design/reference-screens/`.
2. **Hardcoded colours:** a hex search in `mobile/src/screens` and `mobile/src/components` returns only the exempt call file.
3. **Performance on the budget Android phone:** cold start, tab switching, scrolling a long chat, and a **5-minute call with video toggled twice**. If an animation stutters, remove it.
4. **Accessibility:** touch targets at least 44 pt, Reduce Motion respected, white-on-coral uses `coralStrong`, large-font check.
5. **Regression:** `tsc` on both apps, then the whole `docs/checklists/v7-regression-checklist.md` plus the new `v8-device-test-sheet.md` on a **release build** on one Android and one iPhone, with real evidence.
6. **Evidence:** a short screen recording of the app beside the prototype, attached to the PR.
7. **Merge** `ui/v8-parity` into `dev`, tag `v8`.

---

## Acceptance checklist ("same as the prototype")

For each screen, compare the two screenshots and tick:

- [x] Same background colours and gradient direction.
- [x] Nunito with the right weights.
- [x] Same radii and spacing (within a few pixels).
- [x] Coloured glow shadows on primary buttons and the mascot tile.
- [x] Entrance animation on cards and bubbles; owl bounces; stars float; typing dots, wave bars and live dot move.
- [x] No white flash at launch; the splash lasts about 1.2 s.
- [x] No content from the "do not copy" list in Section 2.
- [x] Reduce Motion turns movement off.

---

## Timeline

| Phase | Effort | Main risk | Mitigation |
|---|---|---|---|
| 1 Close v7 | 1.5 days | Call stutters on the budget phone | Stop v8 until the baseline is stable |
| 2 Docs | 1 hour | Broken links | Step 2.5 grep |
| 3 App code | 1 day | Removing something still used | `tsc` after each commit; grep before delete |
| 4 Baseline | 0.5 day | Mismatched screenshots | Same names, same width |
| 5 Foundations | 1 to 1.5 days | Dev client build fails; font pass breaks layout | Keep the stub in history; review the diff |
| 6 Motion kit | 1 day | Jank on a budget phone | Native driver; Reduce Motion |
| 7 Splash | 1 day | Flash between native and JS splash | Same background; minimum display time |
| 8 Screens | 2 to 3 days | Touching call or chat logic | Diff review, visual only |
| 9 Parity and release | 1.5 days | Regression in call or video | Full checklist on a release build |

**Total: about 10 to 12 working days.** Phases 5 and 6 are where the app starts to feel like the prototype. Stop after Phase 7 and compare if you want an early checkpoint.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Polish breaks the stable call | The visual-only rule; the budget-phone 5-minute test; the optional animation can be dropped |
| Demo content from the prototype leaks in | Section 2; the Step 1.1 grep; acceptance checklist |
| Parental gate is weakened | Guardrail 4; no bypass code; manual test that a wrong answer fails |
| Animation slow on budget Android | Transform and opacity only, native driver, remove if it stutters |
| Fonts look wrong | `fontFamily` only, never with `fontWeight` |
| New native modules break the dev client | Step 5.1 rebuild and check before any screen work |
| Cleanup deletes something in use | Grep before each delete; one commit each; `git revert` |
| Docs links break after moving | Step 2.4 table and the Step 2.5 grep |

---

## Definition of Done for v8

- **Docs:** `docs/` has only `README.md` and the folders in Step 2.2; every plan has a status line; no `.patch`, `.xml` or scratch screenshots in git.
- **App code:** no `1234`, no Google button, no mock data, no dead state, no unused dependency; `tsc` passes on both apps.
- **Look:** splash, welcome, auth, chat, call, Parents hub and paywall match the prototype within the acceptance checklist, with real gradients, Nunito, glow shadows and the 12 animations, and Reduce Motion support.
- **Safety:** `LiveVoiceScreen.tsx` diff shows only styles and added child components; `voiceSocket.ts`, `voiceSocketServer.ts` and `geminiLive.ts` are unchanged.
- **Proof:** the full regression checklist passes on a release build on a real Android and iOS device, with evidence recorded.
