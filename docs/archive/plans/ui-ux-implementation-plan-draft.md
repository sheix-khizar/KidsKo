> Status: archived, do not follow

Ground rules (apply to every step)
Work on a new branch, ui/v8-polish, and tag dev as pre-v8 first, the same way you did with pre-v7.
Visual-only changes. Don’t edit hooks, refs, effects, socket handlers or the camera frame loop. Don’t touch voiceSocket.ts, voiceSocketServer.ts or geminiLive.ts.
Put every new animation in its own small component and drop it into the JSX. That keeps diffs easy to review.
Respect “Reduce Motion”. Every animation checks AccessibilityInfo.isReduceMotionEnabled and falls back to static.
Animate only transform and opacity with useNativeDriver: true. Never animate width, height or top.
Phase 0: Baseline (½ day)
Step	Action	Done when
0.1	Create ui/v8-polish, tag pre-v8	Tag exists on the remote
0.2	Open kidsko-final.html at 390px width and screenshot each screen: splash, register, login, chat, call, parents hub, paywall	Prototype screenshots saved in docs/design/reference-screens/
0.3	Run the app and screenshot the same screens	App screenshots saved in docs/baselines/v7/
0.4	Write a difference log with screen, element, what’s wrong and priority (P1 visible at first glance, P2 noticeable, P3 minor)	docs/baselines/v8/diff-log.md exists, with at least the gradient, splash and animation items
Phase 1: Real gradients (½–1 day)
Step	Action	Done when
1.1	Confirm expo-linear-gradient is in mobile/package.json (it is, ~57.0.2). Run npx expo install --check	No version warnings
1.2	Run eas build --profile development --platform android and install the new APK	App opens with no “view manager” error
1.3	Replace the stub in mobile/src/ui/LinearGradient.tsx with a re-export of expo-linear-gradient’s LinearGradient	Button, Mascot and PaywallScreen show true two-colour gradients
1.4	Go through every place that uses gradients (gradients.primary, .parents, .callDark, .splash) and check direction and colour stops against the prototype	Screens match the prototype screenshots
1.5	Keep the old stub in git history in case you need to roll back	Rollback is a single revert
Phase 2: Motion kit (1 day)

Create mobile/src/ui/motion.tsx with these small, reusable components built on React Native’s built-in Animated:

Step	Component	Prototype source	Behaviour
2.1	useReduceMotion() hook	none	Returns true when the OS asks for less motion
2.2	Bounce	owlBounce	Loop: moves up 12px and rotates ±3°, ~3s, ease in-out
2.3	Pulse	orbPulse, ringPulse, pulse	Loop: scale 1→1.08–1.2 and opacity change
2.4	FadeSlideIn	fadeSlideIn	Opacity 0→1 and moves up 10px→0 once on mount, with an optional delay prop for staggering
2.5	TypingDots	typingDot	Three dots hop with staggered delays
2.6	WaveBars	waveBar	N bars loop scaleY 1→0.25 with different delays
2.7	LoadBar	loadBar	Use scaleX with its origin at the left (not width), 0→1
2.8	Pressable wrapper (PressScale)	none	Scales to 0.97 on press with a short spring
2.9	Export everything from ui/index.ts	none	One import path

Done when: all components work in a temporary test screen on the device, and they render a static version when Reduce Motion is on. Delete the temporary screen afterwards (as you did with StyleGuideScreen).

Phase 3: Splash and loading screen (½–1 day)
Step	Action	Done when
3.1	In app.json, set the native splash backgroundColor to 
#FFF8F0 and use the owl/logo image	No white or black flash on launch
3.2	Use expo-splash-screen (preventAutoHideAsync) so the native splash stays until fonts load, then hand over to the animated one	No flicker between native and JS splash
3.3	Rebuild the branded loading view in App.tsx to match #screen-splash: gradient splash, two soft coloured circles (low-opacity Views, not blur) in the corners, Bounce owl, logo, tagline, LoadBar	Side-by-side with the prototype looks the same
3.4	Add a minimum display time (~1.2s) so the splash doesn’t blink past on fast devices	Splash is visible but never delays startup noticeably
Phase 4: Add motion to each screen (1–1.5 days)
Step	Screen	Change	Done when
4.1	Login and Register	Bounce on the mascot, FadeSlideIn on the form fields (staggered 60ms), PressScale on buttons	Form feels like it “arrives”, matches prototype
4.2	Chat (ChatScreen)	FadeSlideIn on new message bubbles, TypingDots while waiting for the AI, Pulse on the mic button while recording. Visual JSX only; no logic changes	Bubbles ease in, dots show during replies
4.3	Chat history drawer	Slide in from the left with a fading overlay	Opens and closes smoothly
4.4	Tab bar and shell	Animated active-tab indicator, short fade when the tab content changes	No hard cuts between tabs
4.5	Call screen	Add WaveBars, a Pulse ring around the status orb, and a blinking live dot, as separate child components inserted in the JSX. No hook, ref, effect or frame-loop changes	Diff review shows only added JSX and styles
4.6	Paywall and Parents Hub	FadeSlideIn on cards, PressScale on plan cards and buttons	Cards stagger in, taps feel responsive
4.7	Lists (history, transcript, memory chips)	Staggered FadeSlideIn for the first ~8 items only	No jank on long lists
Phase 5: Screen transitions (½ day)
Step	Action	Done when
5.1	In App.tsx, wrap the auth/shell screen switch in a keyed FadeSlideIn so Login↔Register↔Main cross-fade instead of cutting	No instant swaps between top-level screens
5.2	Animate modals (ParentalGate, photo attach sheet, Paywall) with fade plus slide-up	Modals no longer pop in
5.3	Keep ChatScreen mounted (already done), so transitions don’t reset the chat	Switching tabs and back keeps the conversation
Phase 6: Visual parity pass and tests (1 day)
Step	Action	Done when
6.1	Work through diff-log.md from top priority down: spacing, radii, shadows, font weights, emoji sizes	All P1 and P2 rows are fixed or marked “accepted”
6.2	Replace leftover hardcoded hex values in screens (about 20 in HomeworkScreen, a few in ChatScreen, ParentsHub, ParentalGate) with theme tokens. LiveVoiceScreen can stay exempt per your v7 rule	Hex search in screens returns only the exempt file
6.3	Fix safe-area handling: switch Screen.tsx and TabBar to react-native-safe-area-context (already installed). The built-in SafeAreaView is deprecated and does nothing on Android	Correct padding on a notched phone and a gesture-navigation phone
6.4	Performance check on the budget Android phone: cold start, tab switching, scrolling a long chat, a 5-minute call with video toggled twice	No visible dropped frames; call behaves as in your v7 baseline
6.5	Run npx tsc --noEmit on mobile, then your v7 regression checklist (auth, chat, homework photo, paywall, transcript, voice call, live video)	All rows still PASS
6.6	Record a short screen video of the app next to the prototype	Attach it to the PR as evidence
6.7	Merge ui/v8-polish into dev and update docs/checklists/v7-regression-checklist.md	Merged with a clean diff
Timeline and risk summary
Phase	Effort	Main risk	Mitigation
0 Baseline	½ day	None	Screenshots give you an objective target
1 Gradients	½–1 day	Dev client rebuild fails	Keep the stub revertable; check the EAS build log first
2 Motion kit	1 day	Jank on low-end devices	Native driver only; Reduce Motion fallback
3 Splash	½–1 day	Flash between native and JS splash	Match the background colour exactly
4 Screens	1–1.5 days	Accidentally touching call or chat logic	Diff review: JSX and styles only
5 Transitions	½ day	Remounting chat	Keep the existing always-mounted chat
6 Parity and tests	1 day	Regression in voice or video	Full v7 checklist on a real device