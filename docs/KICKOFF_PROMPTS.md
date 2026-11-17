# Prompts to paste into Claude Code

Open a terminal in `D:\Diwan\Offers Studio`, run `claude`, and paste one prompt at a time.
Check each phase before moving to the next. Use plan mode (Shift+Tab) for phase 1 so you can approve the plan.

---

## Phase 0: Plan

> First move every folder in `skills/` into `.claude/skills/` (create it) and delete the empty `skills/` folder.
> Then read CLAUDE.md, docs/BUILD_SPEC.md, docs/TOOLKIT_FIXES.md and every skill in .claude/skills.
> Then give me a short build plan for Diwan Offers Studio following the build order in the spec.
> Ask me anything that blocks the plan. Don't write code yet.

## Phase 1: Toolkit

> Unzip `D:\Diwan\Claude outputs\Pipeline\Toolkit-1-Scripts.zip` and `Toolkit-5-Images.zip` into `toolkit/`
> (don't touch the originals). Apply everything in docs/TOOLKIT_FIXES.md: offer.json config, paths,
> Windows UTF-8 and file:// fixes, slides169.json for make.py, the theme layer with themes/classic.css.
> Then write the smoke test and run it on the 6–9 Nov data that's in the zip. Show me the rendered
> page 1 and one category page so I can confirm nothing changed visually.

## Phase 2: Engine on a mock agent

> Build the job store, the stage state machine and the API from BUILD_SPEC §2, §3, §8, with a mock agent
> (AGENT_MODE=mock) that returns canned review.json files and sample images for each stage. Add tests for:
> approve → next stage, edit round → same stage round+1, skipped deliverables, failed stage, re-run of later
> stages after a card edit.

## Phase 3: Studio interface

> Build the Studio UI from BUILD_SPEC §7 on top of the mock agent. Use the frontend-design skill if you have it.
> I want: weeks list, new-week form with look picker and task list, stage stepper, review panel with galleries,
> click-to-pin comments on pages, card table with inline edits, edits panel, approve/send edits, live log,
> round history. Light theme, Madani Arabic for Arabic text. Run it and send me screenshots of each screen.

## Phase 4: Real agent

> Wire the real Offers Agent with the Claude Agent SDK per BUILD_SPEC §4–5. Make sure the project skills load
> (check the init message) and that PYTHONUTF8=1 is set. Run the intake stage on
> `toolkit/items2.json`'s source week as a dry run and show me the review.json it writes.

## Phase 5: Recurring + notifications

> Add the Offers Inbox watcher, the weekly reminder (Monday 10:00 Beirut, editable), Windows toast
> notifications, optional Telegram ping, and a Start with Windows option. Then add Settings.

## Phase 6: Full dry run

> Run a complete week end to end on the 6–9 Nov data with look "market-bold": every stage, one fake edit
> round on the flyer, all exports. Fix anything that breaks, then write a short README for daily use.

---

## Every week after that

Drop the sheet in `D:\Diwan\Offers Inbox\` (or click New week), pick the look, tick deliverables,
add tasks, confirm. Review each stage in the Studio, send edits or approve.

## Keeping it improving

When the client corrects something, tell the agent in an edit ("this is a standing rule"). It updates
`diwan-brand-rules`. For a new design direction, ask Claude Code:

> Create a new look skill `diwan-look-<name>` following the structure of the existing look skills: <describe the mood>.
> Add its theme CSS, run the smoke test with it, and show me pages 1 and 3.
