# Kidsko.ai — Implementation Plan: Category 3 (UI/UX & Visual Design)

**Document:** `docs/fixing-plans/Fixing_plan_category3.md`  
**Date:** October 30, 2026  
**Status:** Approved for Implementation  
**Focus Area:** Category 3 — UI/UX Overhaul, 3D Mascot Artwork & Animated Video Mascot (`vid2.mp4`), Call Tab Experience & Parents Hub Analytics  
**Covers:**
- **Issue #6**: Replace raw `🦉` unicode emoji with official 3D Mascot artwork and animated video mascot (`vid2.mp4`)
- **Issue #4**: Overhaul the Call tab interface to match the high-fidelity dark prototype (`tab-call`)
- **Issue #2 Part B**: Visual usage, history, and learning activity graphs in Parents Hub

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 The Challenge
During real-device testing, three major visual and UX deficiencies were identified that detract from Kidsko's premium positioning:
1. **Raw Emoji Placeholder (Issue #6):** The app frequently renders raw `🦉` unicode text (in chat bubbles, headers, live call screen, drawer, and auth pages) rather than the official 3D mascot artwork (`mobile/assets/App-Icon.jpeg`).
2. **Static Character vs Interactive AI:** An AI companion for young children should feel alive. A 7-second animated 3D video of the mascot (`mobile/assets/vid2.mp4`)—featuring blinking eyes, pencil gestures, book reading, and cheerful expressions—was created for the app, but is not yet wired into the user interface.
3. **Unfinished Call Tab Landing (Issue #4):** The current Call tab in `MainShellScreen.tsx` displays an unfinished single generic card with light-theme header leakage over dark backgrounds. The approved prototype (`docs/design/prototype/kidsko-final.html`) specifies a rich, dual-card choice between **Voice Call** and **AI Vision** with ambient radial glows, pro-tips, and dark-mode child status indicators.
4. **Missing Visual Analytics in Parents Hub (Issue #2 Part B):** Parents Hub provides text chips for remembered facts, but completely lacks visual usage metrics. Parents cannot see how much their child studied, how many questions were asked, which topics were explored, or weekly learning trends. The prototype specifies 4 stat cards, topic progress bars, and a weekly activity bar chart.

### 1.2 Target Experience vs Current State

| Feature / Screen | Current Implementation | Target Experience (Prototype & Video Parity) |
|---|---|---|
| **Live Call Screen (`LiveVoiceScreen`)** | Raw `🦉` text in center pulse rings | **Animated 3D Looping Mascot (`vid2.mp4`)** framed within audio pulse rings |
| **Call Tab Landing (`MainShellScreen`)** | Raw `🦉` text in squircle badge | **Animated 3D Mascot (`vid2.mp4`)** blending seamlessly into the dark backdrop |
| **Assistant Chat Avatar (`ChatScreen`)** | Raw `🦉` text in message bubble | Crisp 36pt 3D Mascot circular avatar (`App-Icon.jpeg`) |
| **Call Tab Landing Choices (Issue #4)** | Single generic card, no direct video launch | Dual choice: **Voice Call** 📞 and **AI Vision** 📷 with "NEW ✨" badge & pro-tip card |
| **Parents Hub Metrics (Issue #2B)** | Only text facts and subscription info | 4 Stat Cards (Questions, Streak, Time, Topics) + Subject Progress Bars + Weekly Bar Chart |

---

## 2. Architecture & Design System Rules

1. **Hybrid Mascot Strategy (Performance & Battery Optimization):**
   * **Hero Video Avatar (`vid2.mp4`)**: Used on hero centerpiece screens (Live Call screen `LiveVoiceScreen.tsx` and Call Tab landing `MainShellScreen.tsx`). Powered by `expo-video` with hardware acceleration, `loop = true`, and strictly **`muted = true`** so video audio never conflicts with Gemini voice or the speech recognizer microphone.
   * **Static 3D Mascot Artwork (`App-Icon.jpeg`)**: Used on high-frequency, repeated elements (Chat bubbles, Transcript bubbles, Drawer items, small headers). This preserves 60 FPS smooth scrolling with zero memory bloat or battery drain.
2. **Zero External Chart Bloat:** Implement all dashboard charts and progress bars using pure React Native Flexbox, View, and LinearGradient components. This guarantees instant render performance on low-end Android devices.
3. **Design Token Integrity:** Strictly use tokens from `mobile/src/theme`:
   - Colors: `colors.coral`, `colors.orange`, `colors.mint`, `colors.sky`, `colors.navyDark`, `colors.surface`, `colors.border`.
   - Typography: `fontFamilies.black` for headings/values, `fontFamilies.bold` for labels, `fontFamilies.medium` for body text.
   - Radii: `radii.sm` (8), `radii.md` (16), `radii.lg` (24), `radii.full` (9999).
4. **Motion & Feedback:** Use existing motion primitives (`PressScale`, `Bounce`, `FadeSlideIn`) for all interactive cards and avatar animations.

---

## 3. Phase-by-Phase Implementation Plan

```
┌────────────────────────────────────────────────────────┐
│  Phase 1: 3D Mascot & Video Avatar Upgrade (Issue #6)   │
│  - Install expo-video for hardware-accelerated loops   │
│  - Upgrade Mascot.tsx: support animated (vid2.mp4) &   │
│    static 3D artwork (App-Icon.jpeg) with squircle/cir  │
│  - Replace raw 🦉 across Chat, Call, Shell, Auth & Hub │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  Phase 2: Call Tab Interface Overhaul (Issue #4)       │
│  - Dark ambient backdrop with radial glow & vid2 mascot│
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
│  - Verification across all visual & video touchpoints  │
└────────────────────────────────────────────────────────┘
```

---

### Phase 1: 3D Mascot & Video Avatar Component Upgrade (Issue #6)
* **Target Files:**
  * `mobile/package.json` (`expo-video`)
  * `mobile/src/ui/Mascot.tsx`
  * `mobile/src/screens/LiveVoiceScreen.tsx`
  * `mobile/src/screens/ChatScreen.tsx`
  * `mobile/src/screens/TranscriptScreen.tsx`
  * `mobile/src/screens/MainShellScreen.tsx`
  * `mobile/src/screens/LoginScreen.tsx`
  * `mobile/src/screens/RegisterScreen.tsx`
  * `mobile/src/screens/PaywallScreen.tsx`
* **Implementation Details:**
  1. **Install `expo-video`**:
     * Add `expo-video` via `npx expo install expo-video` for native video player capabilities.
  2. **Enhance `Mascot.tsx` Component**:
     * Props:
       - `size`: `'xs'` (28px), `'s'` (40px), `'m'` (58px), `'l'` (96px), `'xl'` (120px)
       - `variant`: `'circular'` | `'squircle'`
       - `animated?: boolean`: When `true`, renders `<VideoView />` using `mobile/assets/vid2.mp4` with `loop = true` and `muted = true`. When `false` (default), renders `<Image />` using `mobile/assets/App-Icon.jpeg`.
     * Clean fallback handling to ensure static image renders if video is not available or loading.
  3. **Deploy Animated Video Avatar on Hero Screens:**
     * `LiveVoiceScreen.tsx`: Replace raw `🦉` in center with `<Mascot size="l" variant="circular" animated={true} />`.
     * `MainShellScreen.tsx` (Call Tab): Display `<Mascot size="xl" variant="circular" animated={true} />` in the center of the dark call landing.
  4. **Deploy Static 3D Mascot Artwork on High-Frequency Screens:**
     * `ChatScreen.tsx`: Replace emoji avatar in `renderItem` with `<Mascot size="s" variant="circular" animated={false} />`.
     * `TranscriptScreen.tsx`: Replace assistant emoji with `<Mascot size="s" variant="circular" animated={false} />`.
     * `MainShellScreen.tsx` (Header & Drawer): Replace raw emojis with `<Mascot size="xs" variant="squircle" animated={false} />`.
     * `LoginScreen.tsx` & `RegisterScreen.tsx`: Upgrade header branding with `<Mascot size="m" variant="squircle" animated={false} />`.

---

### Phase 2: Call Tab Interface Overhaul (Issue #4)
* **Target File:** `mobile/src/screens/MainShellScreen.tsx`
* **Implementation Details:**
  1. **Background & Atmosphere:**
     * Immersive dark gradient: `linear-gradient(160deg, #1A1A2E, #16213E, #0F3460)`.
     * Center ambient glowing orb with soft radial gradient and low opacity.
  2. **Animated Mascot Showcase:**
     * Centered animated video mascot `<Mascot size="xl" variant="circular" animated={true} />` surrounded by subtle ambient pulsing rings.
  3. **Header Integration:**
     * When the `call` tab is active, adapt the shell header to dark mode: white Kidsko brand typography with amber `.ai` accent, and a frosted glass child switcher chip (`rgba(255,255,255,0.1)`).
  4. **Dual Action Cards (Voice vs AI Vision):**
     * **Card 1: Voice Call (`🎙️`):**
       - Gradient squircle: Coral/Orange.
       - Title: *"Voice Call"* | Subtitle: *"Talk and listen to Kidsko like a phone call 📞"*.
       - Launches session in voice mode (`videoEnabled: false`).
     * **Card 2: AI Vision (`📷`):**
       - Gradient squircle: Teal/Sky (`#4ECDC4` to `#74B9FF`).
       - Header row: Title *"AI Vision"* + pill *"NEW ✨"*.
       - Subtitle: *"Point camera at anything, Kidsko will explain it! 🔍"*.
       - Launches session directly with video camera active (`videoEnabled: true`).
  5. **Allowance Pill & Pro-Tip Card:**
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
  1. **Audio Isolation Safety:** Ensure `vid2.mp4` video playback never activates audio output or interrupts the Android audio focus stack during live calls.
  2. **Contrast & Legibility:** Verify WCAG AA compliance (4.5:1 ratio) for all text on both dark call surfaces and light dashboard cards.
  3. **Touch Target Sizing:** Ensure all interactive cards, avatars, and switcher buttons have minimum 44x44pt hitSlop and touch bounds.
  4. **Screen Size Adaptability:** Ensure responsive layout across compact displays (e.g., iPhone SE / small Android devices at 360-375pt width) without text truncation or awkward wrapping.

---

### Phase 5: Verification & Definition of Done Battery
* **Verification Matrix:**

| Test # | Check Item | Target Criteria |
|---|---|---|
| **V1** | Animated Mascot Video (`vid2.mp4`) | Looping video plays smoothly and seamlessly in `LiveVoiceScreen` and `MainShellScreen` Call tab |
| **V2** | Video Audio Muted | Video audio is 100% muted (`muted: true`) and never conflicts with live voice calls or mic input |
| **V3** | Static 3D Mascot (`App-Icon.jpeg`) | Chat bubbles and header avatars render high-res static 3D mascot with clean circular crop |
| **V4** | Call Tab Landing (`MainShellScreen`) | Displays dual cards (Voice Call + AI Vision), dark theme header, pro-tip box, and allowance pill |
| **V5** | Direct Video Call Launch | Tapping "AI Vision" card launches `LiveVoiceScreen` with camera active immediately |
| **V6** | Direct Voice Call Launch | Tapping "Voice Call" card launches `LiveVoiceScreen` in audio-only mode |
| **V7** | Parents Hub Stat Cards | 4 Metric cards render cleanly with vibrant icons, bold numbers, and proper spacing |
| **V8** | Topics Progress Bars | Progress bars render accurately with subject badges and gradient fills |
| **V9** | Weekly Activity Chart | Mon-Sun bar chart displays proper heights, day labels, and active day highlight |
| **V10** | TypeScript & Build | `npx tsc --noEmit` and `npm run build` compile with 0 errors across mobile and backend |

---

## 4. Definition of Done (DoD)

- [ ] 1. `mobile/src/ui/Mascot.tsx` supports both animated video (`vid2.mp4`) and static 3D artwork (`App-Icon.jpeg`).
- [ ] 2. Live call screen (`LiveVoiceScreen.tsx`) and Call tab landing feature the animated video mascot in a seamless loop.
- [ ] 3. Video playback is guaranteed muted during live calls with zero audio interference.
- [ ] 4. All raw `🦉` unicode emojis replaced across Chat, Transcript, Drawer, Shell, and Auth screens.
- [ ] 5. Call tab in `MainShellScreen.tsx` matches the prototype (`kidsko-final.html`) with Voice and AI Vision dual cards.
- [ ] 6. Parents Hub renders the 4 Stat Cards, Topics Progress Bars, and Mon-Sun Weekly Activity Bar Chart.
- [ ] 7. Layout is verified responsive on both small and large mobile screens.
- [ ] 8. Zero TypeScript errors (`tsc --noEmit` clean on mobile and backend).
