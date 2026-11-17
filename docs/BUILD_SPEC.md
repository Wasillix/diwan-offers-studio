# Diwan Offers Studio: Build Spec

## 1. What it does

A weekly loop with a human gate after every stage:

```
FEED ──► AGENT WORKS ──► REVIEW GATE ──► (edits? → AGENT APPLIES → REVIEW GATE)* ──► APPROVE ──► next stage
```

1. Waseem (or the scheduler) opens a **Week**: offer name, dates (AR/EN), file tag, design look,
   deliverables, the offer sheet (+ produce list), and a free-text **task list** for anything extra.
2. The **Offers Agent** runs the current stage using the skills in `.claude/skills/`.
3. At the end of each stage it writes `review/<stage>/review.json` and the files to look at,
   then stops. The app notifies Waseem.
4. Waseem reviews in the Studio: approves, or writes edits (general, or pinned to a page / card).
5. Edits resume the **same agent session**, so it remembers the week. It rebuilds and re-submits.
6. Approval moves to the next stage. After the last stage, files land in `D:\Diwan\Claude outputs\<TAG>\`.

## 2. Stages (state machine)

| # | Stage key | Agent does | Review shows | Gate? |
|---|---|---|---|---|
| 1 | `intake` | Inventory sheet: rows, sections, currency, blanks, dupes, missing prices; build `items2.json`; list blocking questions | Inventory table, questions | yes |
| 2 | `images` | Match codes to photos, cut out new ones, flag missing/low-res/wrong-size | Contact sheet of every item photo, missing list | yes |
| 3 | `cards` | Group into cards (`cards2.py`), assign sections, apply brand rules | Card list table (section, AR, EN, unit, price, saving, photos) | yes |
| 4 | `flyer` | Apply the week's **look**, build `flyer.html`, render previews, run `check.js`, run `diwan-design-review` | Page gallery 1080×1350 + check results | yes |
| 5 | `exports` | 2x PNGs, flattened PDF, mobile HTML; verify links + light mode | PDF, mobile preview in a phone frame | yes |
| 6 | `social` | Carousel ≤20 slides + caption | Slide gallery + caption (copy button) | yes |
| 7 | `video` | 16:9 slides + MP4 | Slide gallery + video player | yes |
| 8 | `delivery` | Copy finals to `Claude outputs\<TAG>\`, zip, log open questions | File list with open-folder buttons | final |

- Stages are skipped when the deliverable isn't ticked for that week (e.g. carousel + video only).
- Stage 4 is where most edit rounds happen. Any edit after stage 4 that changes cards or prices
  re-runs the affected later stages automatically (flyer is the master).
- Job status per stage: `pending → running → awaiting_review → (editing → running → awaiting_review)* → approved | skipped | failed`.

## 3. The review contract

The agent ends every stage by writing `data/jobs/<id>/review/<stage>/review.json`:

```json
{
  "stage": "flyer",
  "round": 2,
  "summary": "14 pages, 61 cards, look: market-bold. Applied 6 edits from round 1.",
  "changes": ["Merged Almarai laban flavours into one card", "..."],
  "files": [
    {"path": "review/flyer/r2/page-01.png", "kind": "image", "label": "01 · Index"},
    {"path": "review/flyer/r2/flyer.pdf", "kind": "pdf", "label": "Preview PDF"}
  ],
  "checks": {"overflow": 0, "alignment": "ok", "cards": 61, "skus": 88, "sheet_skus": 88},
  "questions": [{"id": "q1", "text": "Kiri 24 portions has no price in the sheet. Price?", "blocking": false}],
  "assumptions": ["Used 'ابتداءً من' for Puck spreads (3 prices)"]
}
```

The app validates it (zod or a hand check), shows it, and marks the stage `awaiting_review`.
If the agent finishes without a valid review.json, mark the stage `failed` and show the last log lines.

## 4. Agent runner (Claude Agent SDK)

```js
import { query } from '@anthropic-ai/claude-agent-sdk';

const run = query({
  prompt: stagePrompt,                 // built from job.json + stage + edits (see §5)
  options: {
    cwd: jobDir,                       // data/jobs/<id>
    additionalDirectories: [IMAGE_LIBRARY, TOOLKIT_DIR],
    settingSources: ['project'],       // loads CLAUDE.md + .claude/skills from the repo
    skills: 'all',
    allowedTools: ['Read','Write','Edit','Glob','Grep','Bash','TodoWrite','Skill'],
    permissionMode: 'dontAsk',         // anything not allowed is denied, never prompts
    resume: job.stages[stage].sessionId, // undefined on first run, set for edit rounds
    maxTurns: 120,
    env: { ...process.env, PYTHONUTF8: '1' },
    abortController,
  },
});
for await (const msg of run) {
  // msg.type: 'system' (init → save session_id), 'assistant' (stream text/tool_use to the log),
  // 'result' (subtype success|error, total_cost_usd, session_id)
}
```

- Note: settingSources loads from `cwd`. The job dir is not the repo, so either set `cwd` to the repo and
  pass the job dir in the prompt + `additionalDirectories`, or copy/symlink `.claude/` into each job dir.
  Pick one, test that the skills load (the `system/init` message lists them), and document it in CLAUDE.md.
- Auth: uses the Claude Code login on the machine, or `ANTHROPIC_API_KEY` from `.env`. Show which one in Settings
  (`apiKeySource` in the init message).
- Stream every message to `log.jsonl` and to the UI over SSE. Show tool calls as compact lines
  ("Bash · python build_full.py"), text as chat bubbles.
- One agent run at a time per job; a queue if two weeks overlap.
- Cancel button → `abortController.abort()`.
- Store `session_id` and cost per round in `job.json`. Show total cost per week.

## 5. Prompts the app sends

**First run of a stage**
```
Week: {offer_name} · {dates_ar} / {dates_en} · tag {tag} · look {look}
Job folder: {jobDir}. Inputs in inputs/. Build in build/ (a copy of the toolkit).
Deliverables this week: {list}. Extra tasks from Waseem: {task_list}
Run stage "{stage}" of the diwan-offers-pipeline skill. Follow diwan-brand-rules.
{if stage == flyer: Use the diwan-look-{look} skill, then run diwan-design-review before submitting.}
Finish by writing review/{stage}/review.json per the review contract, then stop.
```

**Edit round** (resumed session)
```
Round {n} edits for stage "{stage}":
- [page 4 / card "حلّوم روابي"] change photo to the 200 g pack
- [general] the yellow price bursts feel too loud, tone down
Apply them, rebuild, re-check, and re-submit review/{stage}/review.json (round {n}).
If an edit is a new standing rule, add it to diwan-brand-rules and say so in "changes".
```

**Answers to questions** are sent the same way as edits, tagged `[answer q1]`.

## 6. Feeding the week (inputs)

- **New Week form**: offer name, AR + EN dates, tag (auto from name + dates, editable), look picker
  (cards with a thumbnail for each `diwan-look-*` + "Surprise me" = a look not used in the last 2 weeks),
  deliverable checkboxes (defaults from Settings), file drops for the offer sheet and produce list,
  extra images, and a **task list** textarea (one task per line).
- **Task templates**: Settings holds the default task list (from playbook §5). Each week starts from it
  and Waseem can tick off or add lines. The agent sees the final list.
- **Inbox watcher**: a new `.xlsx` in `D:\Diwan\Offers Inbox\` creates a draft week with the sheet attached,
  guesses dates/name from the file name, and notifies. Intake starts only after Waseem confirms the draft
  (dates and look are easy to get wrong).
- **Weekly schedule**: a configurable reminder (e.g. Monday 10:00 Beirut) creates the draft week from the
  template and nudges Waseem to drop the sheet. Use `node-cron` or a simple interval; also offer a
  "Start with Windows" option (Task Scheduler entry or a startup shortcut).

## 7. The Studio interface

Use the `frontend-design` skill if it's available in your Claude Code; otherwise aim for: calm, work-tool
feel, Loaf-level polish, light theme, Arabic text rendered RTL with Madani Arabic (from `toolkit/fonts`).

Screens:
1. **Weeks**: list of weeks (name, dates, look, current stage, status chip, cost). "New week" button.
2. **Week view**:
   - Left: stage stepper (8 stages, status icons, skipped ones greyed).
   - Center: the current review: summary, changes, assumptions, files.
     - Image galleries with a lightbox and **click-to-pin comments** (click a spot on a page → note pinned
       with page number and x/y; the note text goes into the edit list with "[page N, near x,y]").
     - Card table (stage 3) with inline "edit" per row → becomes an edit line.
     - PDF viewer (browser built-in), phone-frame iframe for mobile HTML, video player.
   - Right: **Edits** panel (list of pending edit lines, add general note, answer questions),
     **Approve** and **Send edits** buttons. Live agent log (collapsible) under it.
   - Round history: see any earlier round's review side by side with the current one.
3. **Settings**: paths (toolkit, image library, inbox, outputs), default deliverables, default task list,
   schedule, notification options, auth status, mock mode toggle.

Notifications: Windows toast (`node-notifier`) + browser Notification API when the agent is waiting for review,
has a blocking question, or failed. Optional: Telegram bot message (token + chat id in `.env`) so Waseem
gets pinged on his phone.

## 8. Data model (`data/jobs/<id>/job.json`)

```json
{
  "id": "2026-11-20-weekend",
  "offer_name": "Weekend Offers", "dates_ar": "20 - 23 تشرين الثاني", "dates_en": "20 – 23 November 2026",
  "tag": "Weekend-20-23Nov", "look": "market-bold",
  "deliverables": ["pdf","png","mobile","carousel","caption","slides169","video"],
  "tasks": ["...", "..."],
  "stages": {
    "intake": {"status": "approved", "rounds": [{"n":1,"sessionId":"...","cost":0.42,"edits":[],"approvedAt":"..."}]},
    "flyer": {"status": "awaiting_review", "sessionId": "...", "rounds": [...]}
  },
  "questions": [{"id":"q1","text":"...","answer":null}],
  "createdAt": "...", "updatedAt": "..."
}
```

Write atomically (write temp + rename). Keep `log.jsonl` append-only.

## 9. Toolkit preparation (do this before the agent work)

See `docs/TOOLKIT_FIXES.md`. In short: unzip `Toolkit-1-Scripts.zip` + `Toolkit-5-Images.zip` from
`D:\Diwan\Claude outputs\Pipeline\` into `toolkit/`, then make every script read the week from
`build/offer.json` (tag, dates, kicker, look) and resolve paths relative to itself, add the theme layer
for looks, and fix the Windows issues. Add a smoke test that builds + renders the last known offer
(the 6–9 Nov weekend data in the zip) and compares page count and card count.

## 10. Build order

1. Toolkit fixes + smoke test (no agent).
2. Job store + state machine + mock agent + API (tests).
3. Studio UI on the mock agent: full loop with fake reviews.
4. Real agent runner (Agent SDK), skill loading check, SSE log.
5. Inbox watcher, schedule, notifications.
6. Dry run on a real past sheet, end to end, then a real week.

## 11. Out of scope locally

- Publishing claude.ai artifacts (mobile artifact link, Design canvas). The app produces the files; publishing
  stays a claude.ai step. Add a "Copy for claude.ai" button that opens the folder with the mobile HTML.
- Posting to Instagram/Facebook.
