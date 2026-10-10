# Kidsko.ai — Plan v7.1: Chat History & Child Memory (Chat only)
**ChatGPT-style chat history (grouped by date, tap to continue), memory that carries across chats, and two bug fixes found while testing on the Android emulator.**

Companion to `kidsko-master-plan-v7.md` (UI/UX). Everything in `kidsko-master-plan-v6.md` still applies.

---

## 1. Scope (decided)

| In scope | Out of scope (decided, do not build) |
|---|---|
| **Part 1:** list a child's past chats grouped by date, open one, continue it, start a new one | **Calls:** no call history, no call transcripts, no call memory. Calls stay stateless. |
| **Part 2:** memory across chats ("knows my name") with parent controls | Search, rename or pin chats, export, sharing between children |
| **Fix F1:** response-cache privacy bug | Changing the 48-hour photo retention |
| **Fix F2:** raw `[STORAGE:...]` text showing in the Transcript | |

**Guardrail kept:** `LiveVoiceScreen.tsx`, `voiceSocket.ts`, `voiceSocketServer.ts` and `geminiLive.ts` are **not touched**. A visible consequence to accept for now: something a child tells Kidsko in a call is not known in chat, and the other way round.

## 2. What testing showed (root causes)

| Symptom | Cause (confirmed in code) |
|---|---|
| Reopening Chat starts empty | `ChatScreen` starts with no messages and no thread id; the first send creates a new thread. Old threads are never loaded. |
| No history list, no "continue" | No backend route lists threads or returns one thread's messages. Only `POST /api/chat`, `DELETE /api/chat/threads/:id`, `/cleanup`, and a flat per-child Transcript exist. The original SRS (FR-10, FR-11) asked for this and it was never built. |
| "My name" forgotten | Gemini only gets the last 10 messages **of the current thread**. Nothing stores facts about the child. The chat prompt doesn't include the child's profile name. |
| Messages are saved | Yes. The Transcript shows them, so storage works. The gap is loading and memory. |
| Raw `📸 [STORAGE:threads/...jpg]` in the Transcript | `ChatScreen` has a local `cleanBubbleContent`; `TranscriptScreen` renders `item.content` raw. |
| Cache privacy bug | For the first message of a new thread, the backend reads and writes a **global** cache keyed only by grade band + normalized text. Personal messages ("my name is Jagal") can be cached and served to other families. Once memory personalizes replies, cached replies would contain a child's name. |

Facts about the database you need to know:
- `chat_threads` has `id, student_id, title, created_at`. It has **no `updated_at`**.
- `chat_threads` and `messages` are **not in the migration files** (they were created by hand in Supabase), so migrations must be defensive (`IF NOT EXISTS`).
- `usage_events.event_type` has a `CHECK` constraint that will reject a new `'memory'` event until it is extended (Step 4.1).
- Mobile never calls `/api/chat/cleanup`; photos are removed only by the 48-hour retention job. So an old photo thread keeps its text but loses its picture after two days.

## 3. Decisions (so nobody re-argues them mid-build)

1. **App opens on a new empty chat**, like ChatGPT. History is one tap away, and the empty state offers a "Continue where you left off" card for the last chat.
2. **Deleting a chat requires the parental gate.** The parent's Transcript is an oversight tool, so a child must not be able to erase it.
3. **Memory stores short, structured facts only**, never sentences and never sensitive data. Parents can see, edit, switch off and erase it.
4. **No cache for personalized chats.** When a child has memory (or the message is personal), the cache is bypassed in both directions.
5. **Photos expire after 2 days** (unchanged). Old photo threads open as text with a clear note.

---

## Phase 1 — Fix the two bugs first (ship alone, before anything else)

**Entry gate:** none. **Time:** 0.5 day.

### Step 1.1 — F1: cache privacy fix
Files: `backend/src/lib/cache.ts`, `backend/src/routes/chat.ts`.

1. In `cache.ts` add `isPersonalMessage(message: string): boolean`. It returns true when the message matches any of: `my name`, `call me`, `i am`, `i'm`, `im `, `my (mom|mum|dad|school|teacher|friend|brother|sister|age|birthday|address|phone|favou?rite)`, `remember`. When unsure, return true (do not cache).
2. In the chat route, only read **or** write the cache when `isFreshThread && !isPersonalMessage(message)`.
3. Also skip the cache write if the reply contains the child's name. Select `student_name` together with `grade_band` and test the reply with a case-insensitive whole-word match.
4. **Version the key** so existing cache entries (possibly containing personal content) can never be served again: hash `v2:${gradeBand}:${normalized}` instead of `${gradeBand}:${normalized}`. Old entries simply expire.
5. Add `backend/src/scripts/testCachePrivacy.ts` in the style of the existing test scripts:
   - Child A (fresh thread) sends `my name is Jagal`; child B on another account sends the same text. B must **not** get a cache hit and the reply must not contain "Jagal".
   - Both send `Why is the sky blue?`. The second still gets a legitimate cache hit.
- **DoD:** the test script passes; a personal message never produces a `cache_hit` event; the generic question still does.

### Step 1.2 — F2: clean message text everywhere
Files: new `mobile/src/utils/messageText.ts`, `ChatScreen.tsx`, `TranscriptScreen.tsx`.
- Move the regex logic out of `ChatScreen`'s local `cleanBubbleContent` into `cleanMessageText(content)`. When the cleaned text is empty (photo with no typed question), return `📷 Homework photo`.
- Use it in **both** screens. Also strip `[IMAGE:...]` (legacy base64 messages), which can be very long.
- **DoD:** the Transcript never shows `[STORAGE` or `[IMAGE`; Chat looks exactly as before.

**Phase 1 Exit KPI:** ✅ Both fixes are verified on the emulator and `testCachePrivacy.ts` passes.

---

## Phase 2 — History backend (Part 1)

**Entry gate:** Phase 1 done. **Time:** 1 day. Backend only; deploy before v7 Phase 4.

### Step 2.1 — Migration
New file `backend/src/db/migrations/<date>_chat_history.sql`:

```sql
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE chat_threads t
SET updated_at = COALESCE(
  (SELECT MAX(m.created_at) FROM messages m WHERE m.thread_id = t.id),
  t.created_at
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_student_updated ON chat_threads(student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_id, created_at);

-- Keeps updated_at current for EVERY insert path (chat, homework) with no route changes.
CREATE OR REPLACE FUNCTION touch_chat_thread() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE chat_threads SET updated_at = COALESCE(NEW.created_at, NOW()) WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_touch_chat_thread ON messages;
CREATE TRIGGER trg_touch_chat_thread AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION touch_chat_thread();
```
`SECURITY DEFINER` matters: messages are inserted with the parent's JWT, and row-level security would otherwise block the thread update.
- Also confirm select policies exist on `chat_threads` and `messages` (the Transcript route relies on them).
- **DoD:** after sending a message in an old thread, that thread's `updated_at` moves to now.

### Step 2.2 — `GET /api/chat/threads?studentId=&limit=30&before=<ISO>`
In `backend/src/routes/chat.ts`:
- Verify the student belongs to the caller (`students.parent_id = req.user.id`, same check as `transcript.ts`); otherwise 404.
- Return `{ threads: [{ id, title, updatedAt }], nextBefore }`, newest first by `updated_at`. Blank titles become "New chat"; the `Homework Help` title is shown as-is.
- **DoD:** returns only that child's threads; paging with `before` works; another parent's student id returns 404.

### Step 2.3 — `GET /api/chat/threads/:threadId/messages?limit=200`
- Verify the thread belongs to one of the caller's students; otherwise 404.
- Return ascending `{ role, text, hasImage, imageExpired, createdAt }`. Do cleaning **server-side** in a new `backend/src/lib/chatHistory.ts` (`cleanMessageForClient`), so base64 `[IMAGE:...]` content is never sent to the app.
- `imageExpired = hasImage && age > 48h`. Define `IMAGE_RETENTION_HOURS = 48` in `chatHistory.ts` with a comment that it must match the retention job.
- **DoD:** markers are gone from `text`; a 3-day-old photo message has `imageExpired: true`.

### Step 2.4 — Tests
`backend/src/scripts/testChatHistoryEndpoints.ts`: parent A can list and read own threads; parent B gets 404 for A's thread and for A's student; ordering is correct; no marker or base64 text in responses.

**Phase 2 Exit KPI:** ✅ Both endpoints pass the test script and the ownership checks. No existing endpoint changed behavior.

---

## Phase 3 — History in the app (Part 1, mobile)

**Entry gate:** Phase 2 deployed. **Time:** 2 days. Build this as **Step 4.5 of the v7 plan** (after the Chat restyle) so the drawer is designed once. It can also be built earlier in the current `ChatScreen` with existing styles.

### Step 3.1 — Service
New `mobile/src/services/threads.ts`: `getThreads(studentId, before?)`, `getThreadMessages(threadId)`, `deleteThread(threadId)` (the existing DELETE route). Use the same auth header pattern as `services/chat.ts`.

### Step 3.2 — Grouping helper
`mobile/src/utils/groupThreads.ts`: `groupThreadsByDate(threads, now)` returns sections **Today / Yesterday / Previous 7 Days / Older**, using the device's local calendar days. Write small test cases for the midnight boundaries.

### Step 3.3 — History drawer
New `ChatHistoryDrawer` (slides from the left, like the original prototype sidebar, in v7 styling):
- Header with a **New chat** button; list grouped by the helper; each row shows title (one line) and time or date; the open chat is highlighted.
- Loading state, pull-to-refresh, "Load more" at the end (30 per page), and an empty state ("No chats yet. Ask your first question!").
- A hamburger button in the Chat header opens it. The drawer shows only the **active child's** chats.
- **DoD:** list matches the database for that child; grouping is correct across days.

### Step 3.4 — Open and continue a chat
Selecting a row: close the drawer, show a loading state, load messages, set `messages` and `threadId`, scroll to the bottom, clear any photo preview. Sending then continues the same thread through the existing `sendMessage(studentId, text, threadId)`.
- Photo bubbles with `imageExpired` show: "📷 Photo removed after 2 days for privacy. Send it again to keep working on it."
- **DoD:** open an old chat, send a follow-up, and the AI's answer uses that chat's context (check with "what did I ask first?"). Force-close and reopen: the chat is in the list and still continues.

### Step 3.5 — New chat and the empty state
- **New chat** resets messages, thread id, preview and input.
- Default on app open is a new chat (Decision 1). The empty state shows the last chat as a "Continue where you left off" card (title plus one tap).
- **DoD:** both paths work; starting a new chat never overwrites an old one.

### Step 3.6 — Delete a chat (parent-gated)
Long-press a row, then the existing `ParentalGate`, then delete via the existing endpoint. Remove it from the list; if it was open, reset to a new chat.
- **DoD:** a child cannot delete without solving the gate; the deleted chat disappears from the Transcript too.

### Step 3.7 — No-quota check
Opening the drawer, loading a chat and scrolling must not change the usage pill count.

**Phase 3 Exit KPI:** ✅ Scripted scenario on the Android emulator: create two chats on two different days (adjust `created_at` and `updated_at` in the dev database), confirm the grouping, force-close the app, reopen, continue the older chat, and the context is kept.

---

## Phase 4 — Memory across chats (Part 2)

**Entry gate:** Phase 1 done (cache fix). Backend steps 4.1 to 4.4 and 4.6 can go any time after Phase 2; the parent screen (4.5) lands with v7 Step 6.3. **Time:** 2 to 3 days.

> **Privacy first.** This stores information about children. The rules below are requirements, not suggestions. The paid (billed) Gemini tier is already a launch blocker (v6), and it matters more now that child text is also sent for fact extraction.

### Step 4.1 — Migration
New file `backend/src/db/migrations/<date>_student_memory.sql`:

```sql
CREATE TABLE IF NOT EXISTS student_memory (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  preferred_name TEXT,
  facts TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent owns student_memory" ON student_memory
FOR ALL
USING (student_id IN (SELECT id FROM students WHERE parent_id = auth.uid()))
WITH CHECK (student_id IN (SELECT id FROM students WHERE parent_id = auth.uid()));

-- Allow cost tracking for memory extraction. Verify the real constraint name first (\d usage_events).
ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_event_type_check;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_event_type_check
  CHECK (event_type IN ('message','scan','cache_hit','live_snapshot','voice_trial','memory'));
```
Also widen the `eventType` union in `logUsageEvent` to include `'memory'`.
- **DoD:** parent A cannot read parent B's row; deleting a student deletes its memory row.

### Step 4.2 — Memory module
New `backend/src/lib/studentMemory.ts`:
- `getMemory(supabase, studentId)` returns `{ preferredName, facts, enabled }`.
- `buildMemoryBlock(memory, studentName)` returns text appended to the system prompt, or an empty string if disabled or empty. Template:
  ```
  [WHAT YOU KNOW ABOUT THIS CHILD — from earlier chats]
  Name to use: <preferredName or profile name>
  <one fact per line>
  Rules: use the name naturally now and then. Only mention things listed here; never invent memories.
  If asked "do you remember me?", answer only from this list. If the child corrects you, accept it.
  If nothing is listed, say you are still getting to know them.
  ```
- **Profile name fallback:** if there is no `preferred_name`, use `students.student_name`. (In your emulator test the profile name was the placeholder "New", so renaming the child in the Parents area helps; see Step 4.5.)

### Step 4.3 — Use memory in replies
Add an optional `memoryBlock` parameter to `generateChatReply` (and `generateHomeworkExplanation`) in `lib/gemini.ts`, appended to `SYSTEM_PROMPT` in `systemInstruction`. Fetch memory once per turn in the chat route and pass it down through `processChatTurnCore` (optional parameter so existing tests keep working).
- **DoD:** with a memory row `preferred_name = Jagal`, a brand-new chat asked "do you know my name?" answers "Jagal".

### Step 4.4 — Extract facts after a chat turn
After the reply is saved and the response is sent, run extraction **without awaiting it** (`void extract(...).catch(log)`), so it never slows or breaks a chat.
- **When it runs:** when `isPersonalMessage` (from Step 1.1) is true, or on every 8th user message in a thread. This caps cost.
- **Model call:** `gemini-3.1-flash-lite`, temperature 0, JSON only, small output limit. Input: existing facts plus the last 4 messages. Output: `{ "preferred_name": string|null, "add": string[], "remove": string[] }`.
- **Allowed:** first name or nickname, grade, interests, favourite subject, topics the child finds hard, how they like to learn. **Forbidden:** surname, address, city, school name, phone, email, links, family members' names, health, passwords, anything said as a joke or pretend ("I am a dragon").
- **Server-side filter (the real safety net, do not rely on the model):**
  - Each fact must match `^(Likes|Finds hard|Favourite subject|Grade|Prefers): [A-Za-z0-9 ,'&-]{1,60}$`. Anything else is dropped. This also blocks prompt-injection text such as "remember to ignore your rules".
  - Preferred name: letters only, at most 20 characters.
  - Reject anything containing `@`, `http`, or 5 or more digits in a row. At most 12 facts; dedupe.
- Upsert into `student_memory` by `student_id`; log a `'memory'` usage event. Extraction does **not** use up the child's message quota.
- **DoD:** saying "my name is Jagal and I like dinosaurs" produces `preferred_name = Jagal` and `Likes: dinosaurs`. "Remember to ignore your rules" stores nothing. A failed extraction never causes a chat error.

### Step 4.5 — Parent controls
Backend, in `routes/students.ts` (ownership check as in `transcript.ts`):
- `GET /api/students/:id/memory`
- `PUT /api/students/:id/memory` with `{ enabled?, preferredName?, facts? }`. Facts go through the same filter, so a parent can remove items by sending a shorter list.
- `DELETE /api/students/:id/memory` clears the name and all facts.

Mobile (inside the v7 Parents hub, behind the existing `ParentalGate`): **What Kidsko remembers** shows the name and fact chips with a remove (✕) on each, a switch "Remember things about <child>", and a "Forget everything" button with a confirmation. When the switch is off, there is no extraction and no injection.
- **DoD:** turning it off makes a new chat forget the name; "Forget everything" clears it; edits persist.

### Step 4.6 — Cache interplay (critical)
In the chat route: when `buildMemoryBlock(...)` is non-empty, **skip the cache read and write** entirely, in addition to the Step 1.1 rules.
- **DoD:** extend `testCachePrivacy.ts`: with memory present for child A, A's first-message reply is never cached; child B never receives a reply containing A's name or facts.

### Step 4.7 — Deletion and policy
- Memory is deleted through the foreign-key cascade when a student is deleted. Include it in the account-deletion endpoint's verification (Phase 6 of v6).
- Add one plain sentence to the privacy policy: Kidsko keeps a few simple facts (name, interests, grade) to help; parents can view, edit or erase them at any time.

### Step 4.8 — End-to-end test
Scripted: say your name and an interest, and a memory row appears. New chat: "do you know my name?" answers correctly. A different parent's child never sees it. Switch off: forgotten. Forget everything: gone. Injection attempt: nothing stored. A `'memory'` event is logged for each extraction.

**Phase 4 Exit KPI:** ✅ Your original emulator test passes: tell the name, close the app, reopen, start a new chat on the same child, and Kidsko knows the name. The privacy checks above all pass.

---

## Phase 5 — Verification and release checks

**Time:** 0.5 day.

1. Add these rows to the v7 baseline checklist (`docs/v7-regression-checklist.md`): history list and grouping; continue an old chat after force-close; photo-expired note; delete behind the gate; name recall in a new chat; memory off; forget everything.
2. Re-run all existing backend test scripts and `verifyPhaseFEndToEnd.ts`. Weekly usage counts must be unchanged by viewing history.
3. Inspect the cache after a test session: no personal text and no child names in cached entries.
4. Confirm the billed Gemini key is used in any environment with real families (v6 launch blocker, now covers extraction too).
5. Update the privacy policy and store data-safety text for stored facts.

---

## Where this fits with the v7 UI plan

| When | Do |
|---|---|
| **Now, before v7** | Phase 1 (both bug fixes). Small, independent, shippable alone. |
| Before v7 Phase 4 | Phase 2 (history backend). |
| v7 Phase 4, Step 4.5 | Phase 3 (history drawer in the redesigned Chat). |
| Any time after Phase 2 | Phase 4 steps 4.1 to 4.4 and 4.6 (memory backend). |
| v7 Step 6.3 | Phase 4 step 4.5 (Parents "What Kidsko remembers"). |
| End | Phase 5. |

## Risk Register

| Risk | Mitigation |
|---|---|
| A child's personal info leaks to another family through the cache | Steps 1.1 and 4.6: personal messages and personalized chats bypass the cache; key versioned; regression test |
| Memory stores sensitive or false data | Strict allowlist regex, forbidden-data prompt, parent view, edit, off switch and erase |
| Prompt injection through "remember..." | Facts must match fixed `Label: value` patterns; free text is never stored |
| Extra Gemini calls raise cost | Extraction only on personal messages or every 8th message; logged as `'memory'`; billed tier in production |
| Trigger or migration breaks inserts under row-level security | `SECURITY DEFINER` trigger; test sending messages as a normal parent after migrating |
| Old photo threads confuse children ("lost track of your picture") | `imageExpired` note in the history view (Step 3.4) |
| Child deletes chats the parent wanted to review | Deletion behind the parental gate (Decision 2) |
| Calls don't share memory with chat | Accepted for now (calls out of scope); revisit later |

## Definition of Done for v7.1

- The cache can never return personal content, and the new test proves it.
- The Transcript shows no raw storage markers.
- Chat has a ChatGPT-style drawer: grouped by date, openable, continuable, with parent-gated delete.
- A child's name and interests are remembered across chats, and parents can see, change, switch off and erase them.
- Call code is unchanged versus the commit before this work.
