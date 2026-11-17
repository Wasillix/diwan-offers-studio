# Toolkit audit: what has to change before the agent can reuse it every week

Source: `D:\Diwan\Claude outputs\Pipeline\Toolkit-1-Scripts.zip` (27 files) and `Toolkit-5-Images.zip`.
The scripts were written inside a cloud session for the 6–9 Nov weekend offer, so they carry that week's
tag, dates and Linux paths. Fix them once in `toolkit/`, then every week only touches `offer.json`,
`items2.json`, `cards2.py` and `image_map.json`.

## 1. One config file per week: `build/offer.json`

```json
{
  "tag": "Weekend-20-23Nov",
  "offer_name_en": "Weekend Offers", "kicker_ar": "عروض نهاية الأسبوع", "kicker_en": "Weekend Offers",
  "dates_ar": "20 - 23 تشرين الثاني", "dates_en": "20 – 23 November 2026",
  "look": "classic",
  "image_library": "D:/Diwan/005 - FMCG Items/001 - Isolated Items/",
  "logos_dir": "D:/Diwan/Diwan Offers layouts/Business Units Logo/"
}
```

Add `offer.py` that loads it (path relative to the script) and exposes `TAG, DATES_AR, DATES_EN, KICKER_AR,
KICKER_EN, LOOK, IMAGE_LIBRARY, LOGOS_DIR`. Every script imports from it.

## 2. Hardcoded values found

| File | Hardcoded | Change to |
|---|---|---|
| `build_full.py` L12–13 | `DATES_AR/EN = "6 - 9 تشرين الثاني"…` | from `offer.py` |
| `build_full.py` L235, L256 | kicker "عروض نهاية الأسبوع / Weekend Offers", `<title>` | `KICKER_AR/EN`, title from config |
| `build_full.py` L28 | `SHEET` skips header row by checking `code != "Diwan Item Number"` | keep, but make the sheet→JSON converter drop the header row |
| `build_full.py` L16–26 | `CATS` list with fixed index images | move to `sections.json` in build/ so the agent can add/drop sections without editing code |
| `build_social.py` docstring + body | bread+healthy+snacks hard-merged into 3 shared slides | compute merges: fill slides to the 20 limit automatically (merge the smallest neighbouring sections first), keep titles "خبز وسناك صحّي" style |
| `build_social.py`, `build_169.py` | `<title>` "Weekend" | config |
| `build_169.py` L68 | kicker | config |
| `build_169.py` L9–10 | one-off rename of a card title (`كوكيز شوفان طاقة…`) | delete; short names belong in `cards2.py` (`short_ar` field) |
| `mobile_build.py` L1, 188, 269–277 | "Weekend", `Diwan-Weekend-6-9Nov_Mobile.html` | config + `TAG` |
| `render_final.js` L12, L19 | `Diwan-Weekend-6-9Nov_…` | read `offer.json` |
| `flatten_pdf.py` L15–17, L28 | tag + PDF title | config |
| `make.py` L2 | `/mnt/user-data/outputs/video169/Diwan-Weekend-6-9Nov_16x9_*.png` | `build/out169/*.png` |
| `make.py` L3, L6–7 | `assert len(S) == 32` and a hand-typed section list | have `build_169.py` write `slides169.json` (`[{"n":1,"section":"idx"},…]`) and read it |
| `make.py` L21 | output name | `Diwan-{TAG}_Slideshow.mp4` |
| `prep_new.py` L4 | `B='/tmp/claude-0/…/build'` | script dir |
| `prep_new.py` L5 | `R='/mnt/user-data/uploads/Diwan/005 - FMCG Items/…'` | `IMAGE_LIBRARY` |
| `prep_new.py` L6–28 | the source→slug map `M` for that week | `build/image_map.json`, written by the agent in the images stage |
| `prep_new.py` | only writes `img/` 800 px | also write `img_pdf/` 560 px and `canvas_assets/` webp 640 px (playbook Phase 2) |
| `prep_imgs.py` L4, L31 | Linux root, writes `../ref/contact2.png` | `IMAGE_LIBRARY`; write contact sheet to `build/review/` |
| `logos.py` L2 | `/mnt/user-data/uploads/Diwan/Diwan Offers layouts/…` | `LOGOS_DIR` (logos are already in `img/`, so this only runs if they change) |
| `make_price_sheet.py` L5, L7 | imports `cards` / `items.json` (old names), 9 cards per page, old category list | update to `cards2`/`items2.json`, 6 per page, `CATS` from config |
| `to_canvas.py` | expects cwd one level above `build/`, `canvas_root/` | out of scope locally (canvas publishing is a claude.ai step); leave as is |

## 3. Windows fixes

- **UTF-8**: every `open(..., "w")` and `.read()` of HTML/CSS/JSON relies on the default encoding. On
  Windows that's cp1252 and Arabic writes crash. Set `PYTHONUTF8=1` for every Python run (the agent runner
  does this) and also add `encoding="utf-8"` to the opens in `build_*.py`, `mobile_build.py`, `offer.py`.
- **file:// URLs**: `render.js`, `render169.js`, `render_final.js`, `check.js`, `check_social.js` do
  `'file://' + dir + '/x.html'`, which breaks on `D:\…` paths. Use
  `require('url').pathToFileURL(path.join(dir, 'x.html')).href`.
- **Output folders**: renderers assume `out/`, `out169/`, `final/png/` exist. `fs.mkdirSync(..., {recursive:true})` first.
- **ffmpeg / Playwright**: check on startup (`ffmpeg -version`, `npx playwright install chromium`), show in Settings.
- **Python**: `py -3` on Windows if `python3` isn't on PATH. Detect once and store.

## 4. Theme layer for design looks

- `build_full.py`, `build_social.py`, `build_169.py`, `mobile_build.py`: after `style.css + style_full.css`,
  append `themes/<LOOK>.css` if it exists, and add `class="look-<LOOK>"` on `<body>`.
- Optional per-look cover override: if `themes/<LOOK>_cover.py` exists with `cover_html(bf)`, use it for
  page 1 instead of the default cover.
- `themes/classic.css` is empty (current design). The `diwan-look-*` skills write/adjust the others.
- Locked sizes (card title 23.4 px, description 19.7 px, 6 cards/page, fixed image frames) must not be
  overridden by a theme. `check.js` should fail if computed sizes differ.

## 5. Smoke test

`npm test` → copies `toolkit/` to a temp build, runs `build_full.py`, `render.js`, `check.js`,
`build_social.py`, `build_169.py`, and asserts: flyer pages > 1, cards in HTML == len(CARDS), carousel ≤ 20,
16:9 slides == len(slides169.json), no overflow. Run it once per look.
