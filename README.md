# Diwan Offers Studio: Claude Code starter kit

Everything Claude Code needs to build the weekly Diwan offers agent and its interface on this PC.
The app doesn't exist yet: Claude Code builds it from these files.

## What's here

| File | What it is |
|---|---|
| `CLAUDE.md` | Project memory Claude Code reads every session |
| `docs/BUILD_SPEC.md` | What to build: stages, review loop, agent runner, interface, data model |
| `docs/TOOLKIT_FIXES.md` | Every hardcoded tag, date and Linux path in the current scripts, and how to fix it |
| `docs/KICKOFF_PROMPTS.md` | The prompts to paste, phase by phase |
| `skills/diwan-offers-pipeline` | The playbook as an agent skill, stage by stage, plus the review contract |
| `skills/diwan-brand-rules` | Client rules, wording, glossary, QA greps |
| `skills/diwan-design-review` | Self-critique pass before anything reaches you |
| `skills/diwan-look-classic` | House look (what the client has approved so far) |
| `skills/diwan-look-market-bold` | Loud sale look: yellow bursts, diagonal bands, halftone |
| `skills/diwan-look-editorial` | Calm premium look: whitespace, halo circles, big red numerals |
| `skills/diwan-look-seasonal` | Occasion themes: Ramadan, Eid, Christmas, Independence Day… |

The skills ship in `skills/` (they can't be written into `.claude` remotely). The first kickoff prompt
tells Claude Code to move them to `.claude/skills/`, where both Claude Code and the Offers Agent load them.

## Before you start (once)

1. Install **Node.js LTS**, **Python 3** (tick "Add to PATH"), **Git for Windows** (Claude Code on Windows uses Git Bash),
   and **ffmpeg** (`winget install ffmpeg`).
2. Python packages: `py -3 -m pip install pillow pypdf reportlab openpyxl`
3. Install Claude Code: `npm install -g @anthropic-ai/claude-code`, then run `claude` once and log in.
4. Create `D:\Diwan\Offers Inbox\`.

## Build it

```
cd "D:\Diwan\Offers Studio"
claude
```

Paste the prompts from `docs/KICKOFF_PROMPTS.md`, starting with Phase 0.

## Adding a design look later

Ask Claude Code: "Create a new look skill `diwan-look-<name>` like the others: <describe the mood>,
add its theme CSS, run the smoke test, and show me pages 1 and 3." It appears in the Studio's look picker.
