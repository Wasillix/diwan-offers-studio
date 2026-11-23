# Diwan Offers Studio

Runs the weekly Diwan Market offers flyer with the Offers Agent. You feed it the week's sheet, the agent
works stage by stage, and it stops after each one so you can review in the Studio, send edits, or approve.

Open it at **http://localhost:4321**.

## Every week

1. **Start the week**
   - Drop Diwan's sheet in `D:\Diwan\Offers Inbox\` (name it like `Weekend Offers 20-23 Nov.xlsx`).
     A draft week appears in the Studio with the name and dates read from the file name. Or
   - click **New week**, pick the dates (Arabic and English fill in), attach the sheet and the produce list.
   - On Monday at 10:00 the reminder makes a draft for the coming Friday–Monday on its own; attach the sheet to it.
2. **Check the draft**: dates, the cover kicker, the **look**, the deliverables (unticked ones skip their
   stages), and the task list for anything extra this week. Then **Start week**.
3. **Review each stage** as it's ready (you get a Windows notification):
   - **Pin a comment** on a page: open it and click the spot.
   - **Edit a card** in the card table (Cards stage).
   - **Answer questions** in the right panel. Red ones block the work.
   - Add a **note** for anything general. Tick **Standing rule** when it should apply every week from now on
     (the agent adds it to the brand rules).
   - **Attach images** to any comment: paste (Ctrl+V), drop the file on the Edits panel, or click **Attach image** /
     **Image**. Mark each one as *Markup* (the client's screenshot with their marks), *Photo* (a product photo to use)
     or *Reference* (something to match, not to put on the flyer). JPG, PNG or WebP; iPhone HEIC needs converting.
   - **Missing item photo**: on the Images stage each item without a photo has **Attach photo**; or use
     **+ Missing item photo** in the Edits panel. The agent cuts it out and puts it on the card next round.
   - **New photos for the photo library**: after that round, check the folder and file name the agent suggests
     and click **Save to library**. The Studio copies it into the photo library, never overwrites a file, and
     **Undo** takes it back out (to `data\trash\library`). Every save is listed in `data\library-log.jsonl`.
   - **Send edits** for another round, or **Approve** to move on. **Compare rounds** shows what changed, and each
     round shows the edits (and images) that produced it.
4. **Delivery**: after the last approval the files are in `D:\Diwan\Claude outputs\<TAG>\`. The mobile page
   and the Design canvas still get published from claude.ai.

| Stage | What you review |
|---|---|
| Intake | Sheet inventory: sections, prices, blanks, duplicates, questions |
| Images | Contact sheet of every photo, missing / low-res / wrong-size list |
| Cards | The card list (names, units, prices, savings) |
| Flyer | Every page at 1080×1350 + check results. Most edit rounds happen here |
| Exports | Flattened PDF, 2x PNGs, mobile page in a phone frame |
| Social | Carousel (max 20 slides) + caption with a Copy button |
| Video | 16:9 slides + the MP4 |
| Delivery | Delivered files, QA results, open questions for the client |

**Changing something after you approved it**: open the stage and use **Reopen with edits**. The later stages that
depend on it rebuild. A price or card change on any stage after Cards rebuilds the flyer and everything after it.

## Starting and stopping

- Open it from the **Diwan Offers Studio** shortcut (desktop or Start menu). It starts the Studio quietly if it
  isn't running yet and opens it in the browser.
- Turn on **Settings → Start with Windows** and it runs in the background from sign-in.
- Or run it yourself in a terminal in this folder:

```
npm run dev
```

- `npm run mock` runs it with the mock agent (canned results, free) for trying things out.
- A run can be cancelled from the week (**Cancel run**). A failed stage shows why and has **Retry**.
- If the PC restarts in the middle of a run, that stage shows as failed: press **Retry**.

## Settings

Weekly reminder (day, time, time zone), Offers Inbox on/off, notifications (Windows, browser, Telegram),
new-week defaults (look, deliverables, tasks), the agent (real or mock, model, effort, budget per run),
folders (each with **Browse…**), Start with Windows, and system checks.

The first time the Studio opens on a PC it shows **Set up the Studio on this PC**: pick the photo library, the
logos, the Offers Inbox and Claude outputs (it counts the photos so you can tell it's the right folder).
**Settings → Folders → Run setup again** brings it back.

**Telegram on your phone** (optional): create a bot with @BotFather, then put its token and your chat id in
`.env` and restart:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## Cost

The agent runs on your Claude Code login (or `ANTHROPIC_API_KEY` in `.env`). Each week shows its agent cost.
Rough guide from the dry runs: intake about $3, a full week with one flyer edit round in the tens of dollars.
Settings → Agent sets a cap per run (default $15).

## When the client changes a rule

Tell the agent in an edit and tick **Standing rule**. It updates `.claude/skills/diwan-brand-rules`. For a new
design direction, ask Claude Code in this folder:

> Create a new look skill `diwan-look-<name>` following the structure of the existing look skills: <the mood>.
> Add its theme CSS, run the smoke test with it, and show me pages 1 and 3.

## Install on a PC

The code lives in a **private** GitHub repo, so whoever installs needs a GitHub account that can see it
(add them as a collaborator on the repo).

1. On the repo page on GitHub, open **Install.cmd** and download it (**Download raw file**).
2. Double-click it. It:
   - installs Git, Node.js, Python 3 and ffmpeg with winget if they're missing,
   - asks where to put the Studio (default `D:\Diwan\Offers Studio`) and downloads it there. The first time,
     a GitHub sign-in window opens,
   - installs the Node and Python packages and the render browser (if that fails, renders use Edge),
   - makes `.env`, copies in the shared product cut-outs,
   - adds a **Diwan Offers Studio** shortcut to the desktop and Start menu,
   - opens a Claude window to sign in once, if this PC isn't signed in yet,
   - opens the Studio, which asks for this PC's folders (Setup).
3. Running it again repairs an install; it never touches `data\` (the weeks) or `.env`.

Each PC has its own weeks, settings and Claude sign-in; nothing is shared between PCs except the code and
the cut-out pack. The weekly reminder and the Offers Inbox only start once Setup is finished on that PC, so
turn the reminder off (Settings) on PCs that shouldn't make Monday's draft.

## Update

Double-click **Update.cmd** in the Studio folder. It downloads the latest version, stops the Studio if it's
running, updates, and starts it again. Weeks, settings and `.env` stay as they are. It refuses to update a
copy whose code was changed on that PC.

## Share new cut-outs with the other PCs

Cut-outs that delivered weeks add to `toolkit\img*` stay on the PC that made them. From the main PC, run
`powershell -ExecutionPolicy Bypass -File scripts\publish-assets.ps1`: it sends the new ones to the repo's
`assets` branch (adds only, never replaces), and other PCs get them with **Update.cmd**.

## Setting up by hand (developers)

1. Install Node.js LTS, Python 3 (tick "Add to PATH"), Git for Windows and ffmpeg (`winget install ffmpeg`).
2. `py -3 -m pip install pillow pypdf reportlab openpyxl fonttools brotli`
3. In this folder: `npm install`, then `npx playwright install --only-shell chromium`
   (without it the renders use Microsoft Edge, which also works).
4. Install Claude Code (`npm install -g @anthropic-ai/claude-code`), run `claude` once and sign in.
5. Copy `.env.example` to `.env` (all values optional).
6. `npm test` checks everything (about 30 s). Then `npm run dev`.

## Folders

```
D:\Diwan\Offers Studio\          this app (data\jobs\<week> holds each week's files, review rounds and log)
D:\Diwan\Offers Inbox\           drop sheets here
D:\Diwan\Claude outputs\<TAG>\   final deliverables per week
D:\Diwan\005 - FMCG Items\...    product photo library (the agent never changes it)
```

Developer notes are in `CLAUDE.md`; the full spec is in `docs/`.

## Credits

The Studio's look follows the design rules of [unslop](https://github.com/heydamir/unslop) by
Damir Sokolovsky (@heydamir), licensed CC BY 4.0, adapted to Diwan Market's brand. The UI font is
Teshrin (Arabic and Latin).
