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

| # | Element | What is wrong in active app (`pre-v8`) | Target in prototype | Priority |
|---|---|---|---|:---:|
| **1** | **Linear Gradients** | `LinearGradient.tsx` is a flat stub rendering only the first stop. Buttons, hero cards, splash, and call screen are completely flat. | Two and three-stop gradients (`primary`, `splash`, `callDark`, `parents`, `teal`) with accurate angles (135°/160°). | **P1** |
| **2** | **Motion & Animation** | Zero `Animated` usage in `mobile/src`. Keyframe animations from prototype are missing. | 12 prototype keyframes: `Bounce` (owl), `Pulse` (orbs/rings), `FadeSlideIn`, `TypingDots`, `WaveBars`, `LoadBar`, `LiveDot`, `FloatStar`, `PressScale`. | **P1** |
| **3** | **Typography (Nunito)** | Nunito fonts load in `App.tsx` but screens use raw `fontWeight` numbers (100+ instances), causing Android to fall back to generic system faux-bold. | Explicit Nunito `fontFamily` mapping (`Nunito_600SemiBold`, `_700Bold`, `_800ExtraBold`, `_900Black`) applied across all screens. | **P1** |
| **4** | **Splash & Loading** | Cold start displays a basic spinner on cream background. | Branded welcome screen with soft floating stars, bouncing mascot tile (120×120, radius 40, glow), 42pt title, and animated left-to-right `LoadBar`. | **P1** |
| **5** | **Native Splash Lifecycle** | No `expo-splash-screen` management. | Native splash background (`#FFF8F0`) with `preventAutoHideAsync` preventing white/black flash during font & token initialization. | **P1** |
| **6** | **Shadows & Glows** | Android `elevation` renders small grey drop shadows; cards and buttons look dull and flat. | Coloured alpha glow shadows (`rgba(255, 107, 107, 0.45)`) via `boxShadow` / `shadowColor`. | **P2** |
| **7** | **Design Tokens & Spacing** | Hardcoded radii, paddings, and button styles drift between screens. | Centralized theme tokens (`spacing`, `radii`, `shadows`, `gradients`, `typography`) referenced universally. | **P2** |

---

## 3. Screen-by-Screen Parity Diff

### 3.1 Splash & Welcome
| Screen Element | Current App State | Target Prototype Look | Priority |
|---|---|---|:---:|
| Initial loading | Simple `ActivityIndicator` spinner | Bouncing owl mascot, floating stars, left-to-right `LoadBar` | **P1** |
| Signed-out onboarding | Direct transition to Login screen | Branded Welcome screen with "🚀 Let's Start Learning!" and "I already have an account" | **P1** |
| Native splash transition | Brief blank layout jump | Seamless transition from native splash to animated JS splash | **P1** |

### 3.2 Authentication (Login & Register)
| Screen Element | Current App State | Target Prototype Look | Priority |
|---|---|---|:---:|
| Form card | Basic bordered card | Deep warm background, 16px radius fields, coral focus ring, glowing primary CTA | **P2** |
| Mascot header | Static small mascot | Mascot with subtle breathing pulse / floating star accents | **P2** |
| Button feedback | Standard opacity dim | `PressScale` tactile depression (scale 0.97) | **P2** |

### 3.3 Chat Screen
| Screen Element | Current App State | Target Prototype Look | Priority |
|---|---|---|:---:|
| Welcome state & chips | Flat outline buttons | Interactive pill buttons with micro-press scale, rounded cards (radius 20) | **P2** |
| Typing indicator | Plain text `"Kidsko is typing…"` | Three hopping dots (`TypingDots`) staggered with 5px hop | **P1** |
| History Drawer | Instant full-screen overlay show/hide | Smooth 260ms slide from left with cubic bezier easing (`0.4, 0, 0.2, 1`) and 45% dark blur overlay | **P2** |
| Input Bar & Action Buttons | Plain circle buttons | 44pt touch targets with subtle border glow, mic listening pulsing animation | **P2** |

### 3.4 Live Voice & Video (Call Screen)
| Screen Element | Current App State | Target Prototype Look | Priority |
|---|---|---|:---:|
| Background | Flat dark background (`#1A1D27`) | Deep dark-blue gradient (`callDark`: `#1A1A2E` → `#16213E` → `#0F3460`) | **P1** |
| Mascot tile | Rectangular container | 100pt rounded mascot tile (radius 36) with coral glow shadow and gentle idle floating bounce | **P1** |
| Audio activity status | Text label only (`Listening…`, `Kidsko is talking…`) | Dynamic `WaveBars` animation during speech + pulsing ring around mascot tile | **P1** |
| Live video indicator | Static green badge | Pulsing `LiveDot` with smooth opacity cycle (1.0 → 0.3) | **P2** |
| End call button | Standard coral button | Prominent circular coral button with glowing shadow and high-contrast icon/label | **P2** |

### 3.5 Parents Hub & Parental Gate
| Screen Element | Current App State | Target Prototype Look | Priority |
|---|---|---|:---:|
| Hub Header | Plain card header | Deep navy-blue `parents` gradient (`#1E3A5F` → `#2980B9`) | **P2** |
| Memory Toggle | System Switch | Branded 46×26 toggle switch with vibrant mint active track | **P3** |
| Fact Chips | Basic pill list | Soft tinted chips with distinct removal touch targets and press feedback | **P3** |
| Parental Gate Dialog | Simple alert modal | Warm card with clear math challenge, primary "Continue" button, and ghost "Cancel" button | **P2** |

### 3.6 Paywall Screen
| Screen Element | Current App State | Target Prototype Look | Priority |
|---|---|---|:---:|
| Plan selection cards | Bordered cards with radio button | Highlighted card with warm coral border glow, best-value pill banner | **P2** |
| Purchase CTA | Solid color button | Two-color primary gradient button with 24px radius, 18pt bold text, and glow shadow | **P1** |

---

## 4. Phase Execution Mapping

All items identified in this log are assigned to subsequent v8 execution phases:
- **Phase 5:** Foundations (LinearGradient dev client, Nunito typography script, tokens, safe areas) fixes Rows 1, 3, 6, 7.
- **Phase 6:** Motion kit (`motion.tsx`) fixes Row 2.
- **Phase 7:** Splash & Welcome fixes Rows 4, 5.
- **Phase 8:** Screen-by-Screen polish addresses all screen-specific P1/P2/P3 rows.
- **Phase 9:** Parity sign-off and final device test checklist.
