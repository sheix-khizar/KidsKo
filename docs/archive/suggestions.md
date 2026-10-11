I'll check the `dev` branch directly.Rate-limited on the API; trying a git clone instead.I cloned the `dev` branch and read the code against the v6 plan, so this is the write-up. One limit: the clone was shallow, so I saw only the latest commit (`ae48966`, Oct 8, "add and pass comprehensive end-to-end verification suite per plan v6"). I read the code but couldn't run it or test on a device.

## Status against the v6 plan

| Phase | Status | What I found in the code |
|---|---|---|
| A. Confirm state | ✅ | The repo is consistent with the audit. |
| B. Voice pool constants | ✅ | Constants are 10/100. The snapshot constants and `checkSnapshotEligibility`/`recordSnapshotUsed` are gone. |
| B2. Live video | 🟡 | Built, but not the way the plan recommended (details below). |
| C. Weekly message/upload limits | ✅ | Limits are 30/3 free and 200/15 premium, with a 7-day reset mirroring voice. Premium now has real caps. |
| D. Call/Chat boundary | ✅ mostly | The Home screen shows only Call, Chat and Transcript. I found no gallery or snapshot UI in the Call screen. Chat still attaches photos through `analyzeHomework`. |
| E. Paywall copy | ✅ | It shows $19.99/mo and $199/yr, 100 Voice & Video minutes, 200 messages and 15 uploads. |
| F. End-to-end verification | 🟡 | `verifyPhaseFEndToEnd.ts` exists and the commit says it passes. I'd guess it covers the limit logic only. The real-device video regression run isn't something a script can prove. |

The earlier phases also hold up. RevenueCat is in (SDK plus a webhook with a secret check), Redis caching is on `/api/chat`, and there is an admin DAU/MAU and cost endpoint. The free transcript view, the parental gate, a retention cleanup job and rate limiting are there too.

## Issues worth knowing about

1. **B2 uses the pattern the plan warned against.** `LiveVoiceScreen` calls `photoOutput.capturePhoto()` every 2.5 seconds on a `setInterval`. That is still a capture-and-encode loop. It uses `react-native-vision-camera`, but not frame processors. It may well be stable now, but the B2.5 gate hasn't been shown: a 5+ minute video call on a budget Android phone with toggles and interruptions. There is also a `console.log` on every frame to remove.
2. **Dead code from the old snapshot feature.**
   - `voiceSocketServer.ts` still handles an `image_capture` message (compress, inject, log) with no limit check.
   - `snapshot_ack` and `snapshot_error` plumbing remains in `voiceSocket.ts`.
   - `weekly_live_snapshots_used` is still in the schema and queries, and `live_snapshot` is still an event type in admin.
3. **Usage counters aren't atomic.** `checkAndIncrementUsage` reads, then writes. Two parallel requests can slip past the limit. The columns are also still named `daily_*` while they now hold weekly counts.
4. **The paywall has a "Sandbox Mode" alert.** Make sure it can't ship in a production build.

## Not started (from the master roadmap)

- **Account deletion endpoint.** A repo-wide search found nothing. Apple requires in-app account deletion, so this blocks store submission.
- **Settings screens.** Profile, password, notifications, appearance and language aren't built. The app has 9 screens against the 11-screen prototype.
- **Safety test.** I found no 10-prompt jailbreak test script.
- **Accessibility pass, privacy policy and Terms.**
- **Phase 7.** The billed Gemini key switch, RevenueCat production setup, EAS builds, store listings and 5 test families.

By phase, 0–5 plus the voice and live-voice work are done, Phase 6 is roughly 15% done (only the retention job and parts of the safety work), and Phase 7 hasn't started.

## What next, in order

1. **Close B2 honestly.** Run the device matrix, including a budget Android phone. If frames hang or stall, move to a real frame processor. Strip the per-frame logging either way.
2. **Clean up the dead snapshot path.** Remove the `image_capture` handler and the ack plumbing, and drop the column in a migration. Consider renaming `daily_*` to `weekly_*` at the same time, while it's cheap.
3. **Make usage increments atomic.** A single Postgres RPC or `UPDATE ... WHERE count < limit` would do it.
4. **Phase 6 blockers:** the account deletion endpoint and the Settings screens. After those, the 10-prompt safety test, the accessibility pass and the privacy policy.
5. **Phase 7:** switch to the billed Gemini key, configure RevenueCat production, build with EAS, submit to the stores, and recruit testers.

I can write the atomic-usage migration and RPC, the account deletion endpoint, or the dead-code removal plan as agent-ready task blocks in the v6 style. Which should I start with?