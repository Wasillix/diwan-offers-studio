# Handoff: Diwan Offers Studio (state on 22 Nov 2026)

This file lets a fresh Claude Code session, on any account, pick up the project without the old
conversation. Read it together with `CLAUDE.md` (dev notes per area), `README.md` (daily use) and
`docs/BUILD_SPEC.md` (full spec). Paste this as your first message in the new session:

> Read docs/HANDOFF.md, CLAUDE.md and README.md, then tell me where things stand.

---

## 1. What the app is

A local Windows app (Node, at http://localhost:4321) that runs the weekly Diwan Market offers flyer for
Loaf Media. Waseem (creative director) drops the client's offer sheet in, and the **Offers Agent**
(Claude Agent SDK, Opus 5.5) works through 8 stages:
intake → images → cards → flyer → exports → social → video → delivery.
It stops after each stage for review in the Studio UI: pin comments on pages, edit cards, answer
questions, send edits, approve. Final files go to `D:\Diwan\Claude outputs\<TAG>\`.

All Diwan knowledge lives in skills under `.claude/skills/`, not in app code:
`diwan-offers-pipeline`, `diwan-brand-rules`, `diwan-design-review`,
`diwan-look-classic / market-bold / editorial / seasonal`.
When the client changes a rule, update the skill.

## 2. How it was built (all committed on `master`)

| Commit | Phase | What |
|---|---|---|
| — | 0 | Skills moved to `.claude/skills`, build plan |
| eb362c8 | 1 | Toolkit unzipped from the Pipeline zips into `toolkit/`, patched, smoke test |
| ff1a0e7 | 2 | Job store, stage state machine, runner queue, REST API + SSE, mock agent, tests |
| af441fb | 3 | Studio UI (plain ES modules, no build), screenshots in `docs/screenshots/` |
| 67ca044 | 4 | Real agent on the Agent SDK (`server/agent/real.js`), intake dry run |
| 1ee7859 | 5 | Offers Inbox watcher, Monday reminder, notifications, Start with Windows, Settings page |
| 89f3021 | 6 | Full end-to-end dry run on the real agent, daily-use README |

`npm test` runs 32 tests (state machine, runner, API, permission guard, recurring, toolkit smoke).

## 3. Key decisions and why

- **The 800 px image library was never zipped.** Waseem said "use image pdf". `toolkit/img/` started
  with the 26 `img_pdf` cut-outs + logos and refills as approved weeks promote their cut-outs (it had
  128 after the dry run).
- **White logo is `Diwan2-01.png`** from `D:\Diwan\Diwan Offers layouts\Templates\Business Units Logo\`
  (`Untitled-1-01.png` is a phone-number graphic, not the logo).
- **Text overlap fixes** (Waseem: "Fix the overlaps first") are in `toolkit/style_full.css`
  (`.hero-t + .sub{margin-top:36px}`, `.tag{gap:4px}`, `.tag b{line-height:1.3}`) and in the 16:9 CSS.
- **Playwright falls back to Microsoft Edge** when its Chromium isn't installed (`toolkit/paths.js launch()`).
- **The agent runs with cwd = repo root**, so `settingSources:['project']` loads the skills. The job folder,
  photo library and logos come in through `additionalDirectories`. A `canUseTool` guard allows writes only
  in the job folder and `diwan-brand-rules` (delivery also gets `Claude outputs\<TAG>` and `toolkit/img`).
  Bash may not change the photo library or git. Web tools, PowerShell and subagents are removed.
- **Never** edit the original toolkit in `D:\Diwan\Claude outputs\Pipeline\`. The agent and scripts **never**
  write to `D:\Diwan\005 - FMCG Items\`. Since 23 Nov 2026 (Waseem's call) the one exception is the Studio's
  **Save to library** button: it copies a new product photo in after Waseem checks the folder and name, never
  overwrites, logs to `data/library-log.jsonl`, and Undo moves it to `data/trash/library/`.
- `nextStage` holds while *any* stage is running, awaiting review, editing or failed. This fixes a bug where
  a rerun started while a later stage was still awaiting review.

## 4. Running it

- PowerShell blocks `npm.ps1` on this PC (execution policy). Use `npm.cmd run dev` or `node server/index.js`,
  or a cmd / Git Bash terminal. Settings → Start with Windows runs node.exe directly, so it isn't affected.
  Changing the execution policy is Waseem's call.
- `npm.cmd run mock` uses the mock agent (free). `AGENT_MODE=mock` for testing before real runs.
- Python is `py -3`, always with `PYTHONUTF8=1` (Arabic writes crash under cp1252 otherwise).
- Windows toasts fail with spawn EPERM inside Claude Code's sandbox; they work when the server runs normally.

## 5. Agent cost: how it works

- The $ figure per round is the SDK's `total_cost_usd`: an **estimate** at API list prices
  (stored in `server/runner.js`, summed in `machine.js`).
- With no `ANTHROPIC_API_KEY` in `.env`, the agent uses the **Claude Code login**, so usage comes out of
  that account's plan limits rather than being billed per dollar. With a key, the figures are real charges.
- **Moving to another Claude Code account:** the Studio uses whichever account `claude` is signed in to on
  this PC. Run `claude`, sign in with the new account, restart the server. Settings → System checks shows
  the auth source; `node test/agent-probe.mjs` (cents) confirms auth, skills and PYTHONUTF8.
- Cap per run: Settings → Agent (default $15). Past the cap the round fails with "hit the $15 budget".
- Dry-run costs: intake ≈ $3; full 6–9 Nov week with one flyer edit round = $22.50 in 52 min
  (intake 5.53, images 3.91, cards 2.07, flyer 4.49, exports 1.91, social 1.02, video 1.81, delivery 1.75).

## 6. Weeks in `data/jobs/` right now

| Week | Look | State | Cost so far |
|---|---|---|---|
| `2026-11-17-dryrun-weekend-6-9nov` (tag DryRun-Weekend-6-9Nov) | market-bold | Was fully done after the dry run. Since reopened: intake/images/cards approved, flyer→video pending, delivery awaiting review | $28.85 |
| `2026-11-17-weekend-6-9nov` | classic | Intake awaiting review with 3 blocking questions | $2.76 |
| `2026-11-18-1yearanniversaryhamra-19nov` (Hamra 1-year anniversary, 19 Nov) | market-bold | Intake approved, images/cards pending, flyer awaiting review; social + video skipped | $62.68 |

Dry-run deliverables are in `D:\Diwan\Claude outputs\DryRun-Weekend-6-9Nov\`. The real
`Diwan-Weekend-6-9Nov_*` files there were never touched.

## 7. Standing rules added in the Hamra week (committed 23 Nov 2026)

`.claude/skills/diwan-brand-rules/SKILL.md` has uncommitted edits, added by the agent from Waseem's
"Standing rule" edits during the Hamra week:
- Bundles (item + add-on, e.g. kashkaval + baguette): one combined photo, add-on in front, main brand readable, group centred.
- L.L. prints with **no closing dot** (`44.999L.L`), as the toolkit does. This settles the open `L.L.` question.
- No client price ("15% off, no price"): saving badge + unit only, no price block, never the `X.XX` placeholder.
- Currency and unit follow the sheet: L.L. where the sheet prices in L.L. (produce, fresh-counter chicken, meat,
  cheese per kg), else $. The unit is the one the sheet prices (cheddar per 200 g → «200 غ»).
- New QA grep: `"pi">X<` and `price ph` must find nothing.

These are the client's rules now. The playbook's currency lines were aligned with them.

## 8. Open items

- Client questions from the dry run: whether the branches list and app links are still current; the full
  list is in the dry-run delivery's `client_questions.txt` (11 items).
- 102 product images were missing for the toolkit smoke test (no 800 px library). This shrinks as weeks promote cut-outs.
- Possible small follow-up: a double-click `Start Studio.cmd` and README switched to `npm.cmd`.

## 9. Where the original conversation is

The full transcript of the build session (on the old account) is at
`C:\Users\Waseem\.claude\projects\D--Diwan-Offers-Studio\e5411f66-d707-43cc-9ec3-16e6034292e3.jsonl`.
It's a raw log; this file is the summary to work from.

## 10. Added on 23 Nov 2026 (not committed yet)

- **Quick edits** (from the night of 22–23 Nov): price, name, unit and saving changes on the flyer stage
  applied by the Studio itself, $0, no agent (`server/quick.js`).
- **Images on edits**: paste, drop or attach images on any comment, each marked as client markup, a new
  product photo, or a reference. The agent opens them with Read (`server/attachments.js`).
- **Missing item photos**: review.json `missing` gives each item an **Attach photo** button. The agent
  suggests a library folder and file name (`library`), and **Save to library** files the photo
  (`server/library.js`).
- **Setup page** on first run with a Windows folder picker (`web/views/setup.js`, `system.js pickFolder`).
- Next on the list: UI redesign with the unslop skill (github.com/heydamir/unslop, CC BY 4.0) in Diwan
  Market branding, then installing from GitHub (`Install.cmd`, private repo), then the client-feedback ideas.
