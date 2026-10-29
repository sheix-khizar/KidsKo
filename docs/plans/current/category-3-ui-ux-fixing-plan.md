# Kidsko.ai — Implementation Plan: Category 3 (UI/UX & Visual Design)

**Document:** `docs/plans/current/category-3-ui-ux-fixing-plan.md`  
**Date:** October 29, 2026  
**Status:** Approved for Implementation  
**Focus Area:** Category 3 — UI/UX Overhaul, 3D Mascot Artwork, Call Tab Experience & Parents Hub Analytics  
**Covers:**
- **Issue #6**: Replace raw `🦉` unicode emoji with official 3D Mascot artwork across all screens
- **Issue #4**: Overhaul the Call tab interface to match the high-fidelity dark prototype (`tab-call`)
- **Issue #2 Part B**: Visual usage, history, and learning activity graphs in Parents Hub

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 The Challenge
During real-device testing, three major visual and UX deficiencies were identified that detract from Kidsko's premium positioning:
1. **Raw Emoji Placeholder (Issue #6):** The app frequently renders raw `🦉` unicode text (in chat bubbles, headers, live call screen, drawer, and auth pages) rather than the high-resolution 3D mascot artwork (`mobile/assets/App-Icon.jpeg`). This looks unpolished and cheap on physical devices.
2. **Unfinished Call Tab Landing (Issue #4):** The current Call tab in `MainShellScreen.tsx` displays an unfinished single generic card with light-theme header leakage over dark backgrounds. The approved prototype (`docs/design/prototype/kidsko-final.html`) specifies a rich, dual-card choice between **Voice Call** and **AI Vision** with ambient radial glows, pro-tips, and dark-mode child status indicators.
3. **Missing Visual Analytics in Parents Hub (Issue #2 Part B):** Parents Hub provides text chips for remembered facts, but completely lacks visual usage metrics. Parents cannot see how much their child studied, how many questions were asked, which topics were explored, or weekly learning trends. The prototype specifies 4 stat cards, topic progress bars, and a weekly activity bar chart.

### 1.2 Target Experience vs Current State

| Feature / Screen | Current Implementation | Target Experience (Prototype Parity) |
|---|---|---|
| **Mascot Identity (Issue #6)** | Raw unicode `🦉` inside basic containers | Scalable, clipped 3D Mascot artwork (`Mascot.tsx`) with rounded squircles and shadows |
| **Assistant Chat Avatar** | Raw `🦉` text in message bubble | 36pt 3D Mascot avatar beside assistant response bubbles |
| **Call Screen Avatar** | Raw `🦉` text in center pulse rings | 110pt 3D Mascot with ambient glow and sound wave bars |
| **Call Tab Landing (Issue #4)** | Single generic card, no direct video launch | Dual choice: **Voice Call** 📞 and **AI Vision** 📷 with "NEW ✨" badge and pro-tip card |
| **Parents Hub Metrics (Issue #2B)** | Only text facts and subscription info | 4 Stat Cards (Questions, Streak, Time, Topics) + Subject Progress Bars + Weekly Bar Chart |

---

## 2. Architecture & Design System Rules

1. **Zero External Chart Bloat:** Implement all charts and progress bars using pure React Native Flexbox, View, and LinearGradient components. This avoids native linking issues, eliminates heavy third-party bundle weight, and guarantees instant render performance on low-end Android devices.
2. **Design Token Integrity:** Strictly use tokens from `mobile/src/theme`:
   - Colors: `colors.coral`, `colors.orange`, `colors.mint`, `colors.sky`, `colors.navyDark`, `colors.surface`, `colors.border`.
   - Typography: `fontFamilies.black` for headings/values, `fontFamilies.bold` for labels, `fontFamilies.medium` for body text.
   - Radii: `radii.sm` (8), `radii.md` (16), `radii.lg` (24), `radii.full` (9999).
3. **Motion & Feedback:** Use existing motion primitives (`PressScale`, `Bounce`, `FadeSlideIn`) for all interactive cards and avatar animations.

---

## 3. Phase-by-Phase Implementation Plan

```
┌────────────────────────────────────────────────────────┐
│  Phase 1: 3D Mascot Component Upgrade (Issue #6)       │
│  - Upgrade Mascot.tsx to render 3D artwork asset       │
│  - Support xs, s, m, l, xl sizes with squircle clipping│
│  - Replace raw 🦉 across Chat, Call, Shell, Auth & Hub │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 2: Call Tab Interface Overhaul (Issue #4)       │
│  - Dark ambient backdrop with radial glow & 3D mascot  │
│  - Voice Call card vs AI Vision card (direct mode launch)
│  - Integrated dark child-chip & usage allowance pill   │
│  - Homework pro-tip container                          │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 3: Visual Analytics in Parents Hub (Issue #2B)  │
│  - 4 Metric Grid Cards (Questions, Streak, Time, Topics)
│  - Topic Progress Bars (Science, Maths, English)       │
│  - Pure Flexbox Weekly Activity Bar Chart (Mon-Sun)    │
│  - Dynamic integration with student activity data      │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 4: Visual Polish, Dark Contrast & Accessibility │
│  - Screen size adaptability (375pt to 430pt)           │
│  - Accessible hit-slop and VoiceOver/TalkBack labels   │
│  - Seamless transitions between Voice & Video modes    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 5: Multi-Screen Verification & Build Checks     │
│  - TypeScript compilation checks (0 errors)            │
│  - Verification across all visual touchpoints          │
└────────────────────────────────────────────────────────┘
```

---

### Phase 1: 3D Mascot Component Upgrade & Universal Replacement (Issue #6)
* **Target Files:**
  * `mobile/src/ui/Mascot.tsx`
  * `mobile/src/screens/ChatScreen.tsx`
  * `mobile/src/screens/LiveVoiceScreen.tsx`
  * `mobile/src/screens/TranscriptScreen.tsx`
  * `mobile/src/screens/MainShellScreen.tsx`
  * `mobile/src/screens/LoginScreen.tsx`
  * `mobile/src/screens/RegisterScreen.tsx`
  * `mobile/src/screens/PaywallScreen.tsx`
* **Implementation Details:**
  1. **Enhance `Mascot.tsx`**:
     * Import `mobile/assets/App-Icon.jpeg` (the official high-res 3D owl with glasses and book).
     * Provide predefined size configurations:
       - `xs`: 28x28 (inline status / chip)
       - `s`: 40x40 (chat bubble avatar / header icon)
       - `m`: 58x58 (cards / action items)
       - `l`: 96x96 (call tab / empty states)
       - `xl`: 120x120 (splash / paywall banner)
     * Add `variant` prop: `'squircle'` (gradient background border) or `'circular'` (avatar circle).
     * Include clean image load fallbacks to ensure rendering robustness.
  2. **Replace Raw `🦉` Emoji Across the App:**
     * `ChatScreen.tsx`: Replace emoji avatar in `renderItem` with `<Mascot size="s" variant="circular" />`.
     * `TranscriptScreen.tsx`: Replace assistant emoji with `<Mascot size="s" variant="circular" />`.
     * `LiveVoiceScreen.tsx`: Center avatar replaced with `<Mascot size="l" variant="circular" />` inside the pulse rings.
     * `MainShellScreen.tsx`: Shell header, Drawer active student badge, and Call tab avatar updated to use `<Mascot />`.
     * `LoginScreen.tsx` & `RegisterScreen.tsx`: Top header mascot upgraded from raw emoji to 3D artwork.

---

### Phase 2: Call Tab Interface Overhaul (Issue #4)
* **Target File:** `mobile/src/screens/MainShellScreen.tsx`
* **Implementation Details:**
  1. **Background & Atmosphere:**
     * Immersive dark gradient: `linear-gradient(160deg, #1A1A2E, #16213E, #0F3460)`.
     * Center ambient glowing orb with soft radial gradient and low opacity.
  2. **Header Integration:**
     * When the `call` tab is active, adapt the shell header to dark mode: white Kidsko brand typography with amber `.ai` accent, and a frosted glass child switcher chip (`rgba(255,255,255,0.1)`).
  3. **Dual Action Cards (Voice vs AI Vision):**
     * **Card 1: Voice Call (`🎙️`):**
       - Gradient squircle: Coral/Orange.
       - Title: *"Voice Call"* | Subtitle: *"Talk and listen to Kidsko like a phone call 📞"*.
       - Launches session in voice mode (`videoEnabled: false`).
     * **Card 2: AI Vision (`📷`):**
       - Gradient squircle: Teal/Sky (`#4ECDC4` to `#74B9FF`).
       - Header row: Title *"AI Vision"* + pill *"NEW ✨"*.
       - Subtitle: *"Point camera at anything, Kidsko will explain it! 🔍"*.
       - Launches session directly with video camera active (`videoEnabled: true`).
  4. **Allowance Pill & Pro-Tip Card:**
     * Prominent usage indicator displaying remaining weekly minutes from billing state.
     * Pro-tip footer: *"💡 Tip: Use AI Vision to point at your homework and Kidsko will help you!"*.

---

### Phase 3: Visual Analytics & Progress Tracking in Parents Hub (Issue #2 Part B)
* **Target File:** `mobile/src/components/ParentsHub.tsx`
* **Implementation Details:**
  1. **4 Stat Grid Cards (2x2 Flex Grid):**
     * **Questions Today (`💬`):** Bold coral counter (e.g., `23` or actual student question count).
     * **Day Streak (`🔥`):** Bold orange counter (e.g., `7` day learning streak).
     * **Time Today (`⏱️`):** Bold sky blue duration (e.g., `34m` active study time).
     * **Topics Explored (`⭐`):** Bold purple count (e.g., `12` concepts covered).
  2. **Topic Progress Breakdown:**
     * Section title: *"📚 Topics This Week"*.
     * Individual subject progress rows with icons:
       - 🔬 **Science** (e.g., 10 Questions, coral/orange gradient bar).
       - 🔢 **Mathematics** (e.g., 8 Questions, coral/orange gradient bar).
       - 📖 **English / Reading** (e.g., 5 Questions, mint/green gradient bar).
       - 🎨 **Art & Creative** (e.g., 3 Questions, sky/blue gradient bar).
     * Styled track and animated fill bars with rounded ends.
  3. **Weekly Activity Bar Chart (Mon–Sun):**
     * Section title: *"📊 Questions This Week"*.
     * 7 vertical bars representing Monday through Sunday.
     * Inactive days: Soft lavender/gray track (`#EEF2FF`).
     * Current active day: Vibrant coral/orange gradient with subtle drop shadow.
     * Day labels underneath (`Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`) in 10pt bold text.

---

### Phase 4: Visual Polish, Dark Contrast & Accessibility
* **Target Files:**
  * `mobile/src/theme/colors.ts`
  * `mobile/src/theme/shadows.ts`
  * All modified components
* **Implementation Details:**
  1. **Contrast & Legibility:** Verify WCAG AA compliance (4.5:1 ratio) for all text on both dark call surfaces and light dashboard cards.
  2. **Touch Target Sizing:** Ensure all interactive cards, avatars, and switcher buttons have minimum 44x44pt hitSlop and touch bounds.
  3. **Screen Size Adaptability:** Ensure responsive layout across compact displays (e.g., iPhone SE / small Android devices at 360-375pt width) without text truncation or awkward wrapping.

---

### Phase 5: Verification & Definition of Done Battery
* **Verification Matrix:**

| Test # | Check Item | Target Criteria |
|---|---|---|
| **V1** | Mascot Component (`Mascot.tsx`) | Renders crisp 3D owl artwork across sizes `xs` through `xl` without blur or clipping glitches |
| **V2** | Chat & Transcript Bubbles | Assistant messages show 3D Mascot circular avatar instead of raw `🦉` emoji |
| **V3** | Call Tab Landing (`MainShellScreen`) | Displays dual cards (Voice Call + AI Vision), dark theme header, pro-tip box, and allowance pill |
| **V4** | Direct Video Call Launch | Tapping "AI Vision" card launches `LiveVoiceScreen` with camera active immediately |
| **V5** | Direct Voice Call Launch | Tapping "Voice Call" card launches `LiveVoiceScreen` in audio-only mode |
| **V6** | Parents Hub Stat Cards | 4 Metric cards render cleanly with vibrant icons, bold numbers, and proper spacing |
| **V7** | Topics Progress Bars | Progress bars render accurately with subject badges and gradient fills |
| **V8** | Weekly Activity Chart | Mon-Sun bar chart displays proper heights, day labels, and active day highlight |
| **V9** | TypeScript & Build | `npx tsc --noEmit` and `npm run build` compile with 0 errors across mobile and backend |

---

## 4. Definition of Done (DoD)

- [ ] 1. `mobile/src/ui/Mascot.tsx` renders the official 3D owl artwork with squircle/circular variants and scalable sizes.
- [ ] 2. All raw `🦉` unicode emojis replaced with `<Mascot />` across Chat, Live Voice, Shell, Drawer, and Auth screens.
- [ ] 3. Call tab in `MainShellScreen.tsx` matches the prototype (`kidsko-final.html`) with Voice and AI Vision dual cards.
- [ ] 4. Parents Hub renders the 4 Stat Cards, Topics Progress Bars, and Mon-Sun Weekly Activity Bar Chart.
- [ ] 5. Layout is verified responsive on both small and large mobile screens.
- [ ] 6. Zero TypeScript errors (`tsc --noEmit` clean on mobile and backend).
