# Diwan Offers Studio

A local app on Waseem's Windows PC that runs the weekly Diwan Market offers flyer with an AI agent.
You feed it the week's offer sheet and task list, the agent works through the playbook stage by stage,
stops at each review gate, shows the results in the Studio interface, waits for edits, applies them,
and repeats until approved. Then it exports every deliverable.

- Client: Diwan Market · Agency: Loaf Media (Beirut)
- Owner: Waseem Labban (creative director). Talks informally, expects polished client-facing output.
- Full build spec: `docs/BUILD_SPEC.md` · Phased prompts: `docs/KICKOFF_PROMPTS.md` · Toolkit audit: `docs/TOOLKIT_FIXES.md`

## Two Claudes in this project

1. **You, building the app** (Claude Code in this folder). Follow `docs/BUILD_SPEC.md`.
2. **The Offers Agent** the app runs every week through the Claude Agent SDK
   (`@anthropic-ai/claude-agent-sdk`, `query()` with `settingSources: ['project']`, `skills: 'all'`).
   It loads the skills in `.claude/skills/`, which hold all the Diwan knowledge:
   - `diwan-offers-pipeline`: the playbook, stage by stage, plus the review contract
   - `diwan-brand-rules`: standing rules, wording, glossary, QA greps (never break these)
   - `diwan-look-*`: design directions (classic, market-bold, editorial, seasonal), one per week
   - `diwan-design-review`: self-critique of every preview before the user sees it

   When the client changes a rule, update the skill, not the app code.

## Layout

```
D:\Diwan\Offers Studio\          ← this repo
  server/        Node (ESM) API, job state machine, agent runner, inbox watcher, scheduler
  web/           Studio interface (served by the server, no build step unless needed)
  toolkit/       Patched copy of the pipeline scripts + fonts + img library (from Pipeline zips)
  .claude/skills Offers Agent knowledge
  data/jobs/<id> One folder per offer week (job.json, inputs/, build/, review/, final/, log.jsonl)
D:\Diwan\Offers Inbox\           Drop an offer sheet here → a new week job starts
D:\Diwan\Claude outputs\<TAG>\   Final deliverables per week
D:\Diwan\005 - FMCG Items\001 - Isolated Items\   Product photo library (read-only)
```

## Rules for building

- Windows first. Paths with spaces (`Claude outputs`, `005 - FMCG Items`): always quote, use `path.join`,
  and `url.pathToFileURL()` for Playwright `file://` URLs.
- Run Python with `PYTHONUTF8=1` (Arabic file writes crash under cp1252 otherwise).
- Never edit the original toolkit in `D:\Diwan\Claude outputs\Pipeline\`; work on `toolkit/` and copy it
  into each job's `build/`.
- The image library under `005 - FMCG Items` is read-only for the agent and for scripts. Cut-outs go to the
  job's `build/img/` and are promoted to `toolkit/img/` only after the week is approved. The one exception
  (Waseem's decision, 23 Nov 2026): `server/library.js` copies a new product photo into the library when
  Waseem clicks **Save to library** on a week. Never overwrite, stay inside the library, log every save.
- Keep it simple: Express + plain JS/HTML is fine. Add a framework only if the UI really needs it.
- Secrets in `.env` (git-ignored). No keys in code.
- Test with `AGENT_MODE=mock` (canned stage results) before spending real agent runs.

## Commands (fill in as you build)

- `npm run dev`: start server + UI at http://localhost:4321
- `npm run mock`: same with the mock agent
- `npm test`: state machine + toolkit smoke tests
- `npm run test:engine`: state machine, runner + mock agent, HTTP API (~3 s)
- `npm run smoke`: toolkit only (flyer, carousel, 16:9) for every look in `toolkit/themes/`, builds in `data/smoke/<look>/`
- `npm run smoke:full`: same plus final PNGs, flattened PDF, mobile HTML and the MP4 (~1 min)

## Install and update (Install.cmd, Update.cmd, scripts/)

- `Install.cmd` is self-contained (batch header + PowerShell after the `##PS#` marker) so it works when
  downloaded alone: winget prerequisites → `git clone` of the private repo (Git Credential Manager signs in)
  → `scripts/setup.ps1`. Env vars for tests: `DIWAN_REPO`, `DIWAN_DIR`, `DIWAN_YES`, `DIWAN_NO_OPEN`,
  `DIWAN_NOPAUSE`, `DIWAN_SHORTCUT_DIR`. The default repo URL is at the top of the PowerShell part.
- `scripts/setup.ps1` (install and `-Update`): `npm ci` only when package-lock changed, Playwright shell with a
  6-minute limit (its unpacking hangs on some PCs; update only retries when packages changed), pip, `.env`,
  cut-out pack, shortcuts, Claude sign-in. Never touches `data/` or `.env` values.
- `scripts/update.ps1`: refuses on local changes or local commits, `git merge --ff-only`, stops the server
  (node processes running this folder's `server/index.js`) and starts it again.
- `scripts/open-studio.mjs` via `scripts/Open Studio.vbs` (shortcut target, no window): plain Node, starts
  the server detached if `/api/meta` doesn't answer, opens the browser; `--no-browser` for Update. On failure
  it writes `data/launch-error.txt` and the .vbs shows it (closes itself after 2 minutes).
- Antivirus: Kaspersky (PDM:Trojan.Win32.Generic, 23 Nov 2026) removed `server/index.js` after the server
  showed a toast through `powershell -WindowStyle Hidden -EncodedCommand`. Never start PowerShell from the
  server or launcher with -EncodedCommand, -WindowStyle Hidden or -ExecutionPolicy Bypass. Use
  `server/powershell.js` (`runPowerShell`: script through stdin, ASCII only, values in env vars).
- Cut-out pack: orphan branch `assets` (`img/`, `img_pdf/`, `canvas_assets/`), fetched with `--depth 1`
  and copied in new-files-only. `scripts/publish-assets.ps1` adds new files to it from a PC.
- Scripts run in Windows PowerShell 5.1: keep them ASCII (BOM-less files are read as ANSI) and CRLF
  (`.gitattributes`). Native stderr redirected under `ErrorActionPreference=Stop` throws: use `Test-Native`.
  PowerShell variables ignore case (`$p` overwrites `$P`). Git Bash `sed -i` strips CRs from CRLF files.
- Scheduler and Inbox watcher do nothing until `settings.setup.done` (first-run Setup finished on that PC).

## Images on edits, missing photos, the library, Setup

- `attachments.js`: `POST /api/jobs/:id/attachments` (one image, ≤25 MB) → `attachments/<stage>/<stamp>-<slug>.<ext>`,
  extension from the bytes (PNG/JPG/WebP; HEIC refused with a hint). Any edit can carry
  `images: [{ path, role: markup|photo|reference }]`; kind `photo` = a missing item's photo (needs an image).
  `editLine(e, jobDir)` gives the agent absolute paths; `editPrompt` adds the attachment rules only when images exist.
- review.json gained optional `missing` (items with no photo → "Attach photo" buttons) and `library`
  (cut-out + suggested folder + name). Bad entries are dropped into `review.warnings` (logged), never fail a round.
- `library.js`: `POST /api/jobs/:id/library` copies with `COPYFILE_EXCL` (409 `exists` → pick another name),
  records `job.library[]` and `data/library-log.jsonl`; `…/library/undo` moves a Studio-added, unchanged file to
  `data/trash/library/`. `GET /api/library/folders` feeds the folder suggestions (two levels).
- Setup: `settings.setup.done`; the UI router sends every page to `#/setup` until Finish (`POST /api/setup`).
  `POST /api/system/pick-folder` opens the Windows FolderBrowserDialog through PowerShell (`system.js pickFolder`,
  args via env vars, `-EncodedCommand`); tests inject `pickFolderImpl`. `POST /api/system/folder-check` counts photos.
- The mock agent lists 2 `missing` items on Images and turns attached photos into `library` suggestions.
  Careful: a mock server still points at the real photo library, so don't click Save there.

## Engine notes (server/)

- `stages.js` stage table + deliverables → `machine.js` pure transitions (throws `MachineError`) →
  `runner.js` queue (one agent run at a time), log/SSE events, review.json check → `app.js` API.
- A stage only advances through `machine.js`. `nextStage` holds while any stage is running, waiting, editing or failed.
- `cards_changed: true` in a review (edit round, cards or later) sends approved card stages back to pending
  as `rerun` rounds; reopening an approved stage ≤ cards rebuilds everything after it.
- Mock agent: `server/agent/mock.js`; uses `data/smoke/<look>` renders when present. `MOCK_FAIL=flyer:1` fails once.
- Each round's review.json is archived to `review/<stage>/r<n>/review.json` for round history.

## Real agent notes (server/agent/real.js)

- One stage round = one Agent SDK `query()`. **cwd is the repo root** (so `settingSources: ['project']` loads
  this file + `.claude/skills`, and standing-rule edits land in the real `diwan-brand-rules`); the job folder,
  photo library and logos folder come in via `additionalDirectories`; the prompt uses absolute job paths.
  The agent's system prompt (appended) tells it this file's build rules aren't for it.
- The init message must list `diwan-offers-pipeline`, `diwan-brand-rules`, `diwan-design-review`, or the
  run aborts. Each round stores `agent: {model, apiKeySource, skills}` in job.json.
- Permissions: Read/Glob/Grep/TodoWrite pre-approved; `canUseTool` allows Write/Edit only in the job folder
  or `diwan-brand-rules`, Bash except changes to the photo library or git; Web*, PowerShell, subagents removed.
- Env: `AGENT_MODEL` (default `claude-opus-5-5`), `AGENT_EFFORT` (default `high`), `AGENT_MAX_BUDGET_USD`
  (default 15 per run). Auth: Claude Code login unless `ANTHROPIC_API_KEY` is set in `.env`.
- `node test/agent-probe.mjs` (cents) checks auth, skills and PYTHONUTF8. `node test/dry-run-intake.mjs`
  runs intake on the 6–9 Nov sheet rebuilt by `test/fixtures/make_sheet.py`.

## Recurring + notifications (Phase 5)

- `settings.js`: data/settings.json merged over defaults (paths, new-week defaults, schedule, inbox,
  notifications, agent). Paths apply to the running config; agent mode switches live (`--mock` wins).
- `inbox.js`: watches the Offers Inbox (fs.watch + 60 s scan); a new .xlsx → draft week (name/dates from the
  file name via `dates.js`), never auto-confirmed, inbox files never touched; data/inbox.json remembers files.
- `scheduler.js`: Monday 10:00 Asia/Beirut by default; fires once per day at or after the time; draft for
  the coming Friday–Monday unless one with those dates exists.
- `notify.js`: Windows toast via PowerShell + WinRT (no install; clicking opens the week), browser
  notifications over SSE `notify` events, optional Telegram from .env. `watchTransitions` notifies on
  review / question / failed / done. (Spawning PowerShell fails with EPERM inside Claude Code's sandbox; fine
  when the server runs normally.)
- `startup.js`: Start with Windows = one .vbs launcher in the user's Startup folder (Settings toggle only).

## Studio UI notes (web/)

- Plain ES modules, no build: `app.js` (hash router) → `views/weeks.js`, `views/new-week.js`, `views/week.js`,
  `views/lightbox.js`; helpers in `lib.js`. Served with `Cache-Control: no-cache`, so a refresh picks up edits.
- Arabic goes through `txt()` (RTL; English sentences that quote Arabic keep LTR and isolate the Arabic).
- Look: Diwan Market brand on the unslop rules (github.com/heydamir/unslop, CC BY 4.0, Damir Sokolovsky).
  One family for both scripts, **Teshrin** (`web/fonts/teshrin-400|500|600.otf`), weights 400/500 only.
  Warm neutrals from paper #F5F5F2 / halo #F0ECE5, one accent (Diwan red #A12222) for the primary action,
  selection, pins and "ready for review". One red primary button per area; other actions use `.btn-mark`
  (secondary). Status is a dot + text (`chip()`), never a filled pill; no pulse animations; colour-only
  transitions, 150 ms, `--ease`. The yellow #EDC11C date `.sticker` is the signature: week dates only.
  Arabic: letter-spacing 0, line-height 1.7, no italics. The flyer itself keeps Madani (toolkit fonts).
  Tokens live at the top of `web/styles.css`.
- Pins are stored in 1080-px page coordinates (`kind:'pin', file, page, x, y`); unsent edits are saved
  on the server (`PUT …/pending`) so they survive a refresh.
- Screenshots: run the mock server with `DATA_DIR=data/demo`, seed weeks, then `node test/screens.mjs` → `docs/screenshots/`.

## Toolkit notes

- The week lives in `build/offer.json` + `sections.json`; `toolkit/README.md` lists every script.
- Toolkit `.js` files are CommonJS (`toolkit/package.json`); the repo is ESM. Keep that file in every build copy.
- Renderers use Playwright's Chromium and fall back to Microsoft Edge if it isn't installed (`PW_CHANNEL` forces one).
- `toolkit/img/` only has the 26 `img_pdf` cut-outs + logos; the 800 px library was never zipped. It refills
  as approved weeks promote their cut-outs.
