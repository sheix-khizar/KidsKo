# Kidsko.ai — UI/UX v8 Visual Parity Difference Log

**Date:** October 17, 2026  
**Baseline commit:** `pre-v8` (`47493ba`)  
**Target reference:** `docs/design/prototype/kidsko-final.html` and `docs/design/reference-screens/`  
**App milestone baselines:** `docs/baselines/v7/`

---

## 1. Summary of Priority Tiers

- **P1 (Visible at first glance):** Critical brand and visual foundation gaps (flat fake gradients, unapplied Nunito fonts, missing animations, spinner splash instead of welcome).
- **P2 (Noticeable on interaction):** Motion, transitions, shadows/glows, drawer slide, wave bars, button micro-interactions.
- **P3 (Minor polish):** Spacing inconsistencies, chip paddings, toggle dimensions.

---

## 2. Core Foundational Gaps (Section 1 Root Causes)

| # | Element | What was wrong in active app (`pre-v8`) | Target in prototype | Priority | Resolution Status (v8) |
|---|---|---|---|:---:|:---:|
| **1** | **Linear Gradients** | `LinearGradient.tsx` was a flat stub rendering only the first stop. Buttons, hero cards, splash, and call screen were flat. | Two and three-stop gradients (`primary`, `splash`, `callDark`, `parents`, `teal`) with accurate angles (135°/160°). | **P1** | **RESOLVED** (`expo-linear-gradient` native module active in dev client, verified across buttons, headers, splash) |
| **2** | **Motion & Animation** | Zero `Animated` usage in `mobile/src`. Keyframe animations from prototype were missing. | 12 prototype keyframes: `Bounce` (owl), `Pulse` (orbs/rings), `FadeSlideIn`, `TypingDots`, `WaveBars`, `LoadBar`, `LiveDot`, `FloatStar`, `PressScale`. | **P1** | **RESOLVED** (`mobile/src/ui/motion.tsx` comprehensive animation kit implemented with Reduce Motion respect) |
| **3** | **Typography (Nunito)** | Nunito fonts loaded in `App.tsx` but screens used raw `fontWeight` numbers, causing Android fallback to faux-bold. | Explicit Nunito `fontFamily` mapping (`Nunito_600SemiBold`, `_700Bold`, `_800ExtraBold`, `_900Black`) applied across all screens. | **P1** | **RESOLVED** (`fontFamilies` applied universally across all screens and components, zero raw numeric font weights) |
| **4** | **Splash & Loading** | Cold start displayed a basic spinner on cream background. | Branded welcome screen with soft floating stars, bouncing mascot tile (120×120, radius 40, glow), 42pt title, and animated left-to-right `LoadBar`. | **P1** | **RESOLVED** (`WelcomeScreen.tsx` + `App.tsx` branded splash loaded with `LoadBar`, captured in `splash.png`) |
| **5** | **Native Splash Lifecycle** | No `expo-splash-screen` management. | Native splash background (`#FFF8F0`) with `preventAutoHideAsync` preventing white/black flash during font & token initialization. | **P1** | **RESOLVED** (`mobile/app.json` + `App.tsx` splash lifecycle cleanly orchestrated with no launch flash) |
| **6** | **Shadows & Glows** | Android `elevation` rendered small grey drop shadows; cards and buttons looked dull and flat. | Coloured alpha glow shadows (`rgba(255, 107, 107, 0.45)`) via `boxShadow` / `shadowColor`. | **P2** | **RESOLVED** (`mobile/src/theme/shadows.ts` with brand-colored glowing drop shadows) |
| **7** | **Design Tokens & Spacing** | Hardcoded radii, paddings, and button styles drifted between screens. | Centralized theme tokens (`spacing`, `radii`, `shadows`, `gradients`, `typography`) referenced universally. | **P2** | **RESOLVED** (`mobile/src/theme/` centralized token system referenced in 100% of screens and components) |

---

## 3. Screen-by-Screen Parity Diff

### 3.1 Splash & Welcome
| Screen Element | Target Prototype Look | Priority | Resolution Status (v8) |
|---|---|:---:|:---:|
| Initial loading | Bouncing owl mascot, floating stars, left-to-right `LoadBar` | **P1** | **RESOLVED** (`splash.png`) |
| Signed-out onboarding | Branded Welcome screen with "🚀 Let's Start Learning!" and "I already have an account" | **P1** | **RESOLVED** (`WelcomeScreen.tsx`) |
| Native splash transition | Seamless transition from native splash to animated JS splash | **P1** | **RESOLVED** (No layout flashes) |

### 3.2 Authentication (Login & Register)
| Screen Element | Target Prototype Look | Priority | Resolution Status (v8) |
|---|---|:---:|:---:|
| Form card | Deep warm background, 16px radius fields, coral focus ring, glowing primary CTA | **P2** | **RESOLVED** (`login.png`, `register.png`) |
| Mascot header | Mascot with subtle breathing pulse / floating star accents | **P2** | **RESOLVED** (`Mascot` + `FloatStar`) |
| Button feedback | `PressScale` tactile depression (scale 0.97) | **P2** | **RESOLVED** (Native `Pressable` with pressed transform) |

### 3.3 Chat Screen
| Screen Element | Target Prototype Look | Priority | Resolution Status (v8) |
|---|---|:---:|:---:|
| Welcome state & chips | Interactive pill buttons with micro-press scale, rounded cards (radius 20) | **P2** | **RESOLVED** (`chat.png`) |
| Typing indicator | Three hopping dots (`TypingDots`) staggered with 5px hop | **P1** | **RESOLVED** (`TypingDots` in `motion.tsx`) |
| History Drawer | Smooth 260ms slide from left with cubic bezier easing (`0.4, 0, 0.2, 1`) and 45% dark blur overlay | **P2** | **RESOLVED** (`ChatScreen.tsx` animated drawer) |
| Input Bar & Action Buttons | 44pt touch targets with subtle border glow, mic listening pulsing animation | **P2** | **RESOLVED** (48pt touch targets, pulsing mic ring) |

### 3.4 Live Voice & Video (Call Screen)
| Screen Element | Target Prototype Look | Priority | Resolution Status (v8) |
|---|---|:---:|:---:|
| Background | Deep dark-blue gradient (`callDark`: `#1A1A2E` → `#16213E` → `#0F3460`) | **P1** | **RESOLVED** (`call.png`) |
| Mascot tile | 100pt rounded mascot tile (radius 36) with coral glow shadow and gentle idle floating bounce | **P1** | **RESOLVED** (`Bounce` mascot tile) |
| Audio activity status | Dynamic `WaveBars` animation during speech + pulsing ring around mascot tile | **P1** | **RESOLVED** (`WaveBars` component) |
| Live video indicator | Pulsing `LiveDot` with smooth opacity cycle (1.0 → 0.3) | **P2** | **RESOLVED** (`LiveDot` in video overlay) |
| End call button | Prominent circular coral button with glowing shadow and high-contrast icon/label | **P2** | **RESOLVED** (End Call CTA with glow) |

### 3.5 Parents Hub & Parental Gate
| Screen Element | Target Prototype Look | Priority | Resolution Status (v8) |
|---|---|:---:|:---:|
| Hub Header | Deep navy-blue `parents` gradient (`#1E3A5F` → `#2980B9`) | **P2** | **RESOLVED** (`parents-hub.png`) |
| Memory Toggle | Branded 46×26 toggle switch with vibrant mint active track | **P3** | **RESOLVED** (Custom mint switch) |
| Fact Chips | Soft tinted chips with distinct removal touch targets and press feedback | **P3** | **RESOLVED** (Chip component with delete tap) |
| Parental Gate Dialog | Warm card with clear math challenge, primary "Continue" button, and ghost "Cancel" button | **P2** | **RESOLVED** (`parents-gate.png`, Enter key submission) |

### 3.6 Paywall Screen
| Screen Element | Target Prototype Look | Priority | Resolution Status (v8) |
|---|---|:---:|:---:|
| Plan selection cards | Highlighted card with warm coral border glow, best-value pill banner | **P2** | **RESOLVED** (`PaywallScreen.tsx`) |
| Purchase CTA | Two-color primary gradient button with 24px radius, 18pt bold text, and glow shadow | **P1** | **RESOLVED** (`Button` primary with glow) |

---

## 4. Milestone Sign-off (v8 Release)

- **Reference Screenshots**: All 7 reference screen captures verified and preserved in `docs/baselines/v8/`:
  - `docs/baselines/v8/call.png`
  - `docs/baselines/v8/chat.png`
  - `docs/baselines/v8/login.png`
  - `docs/baselines/v8/parents-gate.png`
  - `docs/baselines/v8/parents-hub.png`
  - `docs/baselines/v8/register.png`
  - `docs/baselines/v8/splash.png`
- **Tokens Pass**: 100% semantic color tokens across `mobile/src/screens` and `mobile/src/components` (only exempt `LiveVoiceScreen.tsx` retains theme-consistent hex colors).
- **TypeScript**: Passes clean on both `mobile` and `backend`.
- **Inviolable Contracts**: Zero lines diff against pre-v8 baseline on `voiceSocket.ts`, `voiceSocketServer.ts`, and `geminiLive.ts`.

