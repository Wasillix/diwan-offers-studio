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
- The image library under `005 - FMCG Items` is read-only. Cut-outs go to the job's `build/img/` and are
  promoted to `toolkit/img/` only after the week is approved.
- Keep it simple: Express + plain JS/HTML is fine. Add a framework only if the UI really needs it.
- Secrets in `.env` (git-ignored). No keys in code.
- Test with `AGENT_MODE=mock` (canned stage results) before spending real agent runs.

## Commands (fill in as you build)

- `npm run dev`: start server + UI at http://localhost:4321
- `npm run mock`: same with the mock agent
- `npm test`: state machine + toolkit smoke tests
