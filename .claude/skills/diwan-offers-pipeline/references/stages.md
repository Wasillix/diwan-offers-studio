# Stages: what to do and which scripts to run

Paths are relative to the job folder. `build/` is a fresh copy of the patched toolkit.
Run Python as the app configured it (`python` / `py -3`) with `PYTHONUTF8=1`. Node scripts take the
absolute build path as the first argument.

## 1. intake

- Read the offer sheet in `inputs/` (openpyxl). Standard columns: Page · Division · Diwan Item Number ·
  English Description · UOM · Arabic Description · Marketing Comment · New RRP TTC · Customer Saving ·
  Price In 200G. "Customer Saving" is a negative fraction (−0.147 = 14%). USD, except produce (FRV) in L.L.
- Merge the produce price list if there is one.
- Write `build/items2.json` (one row per item number, keys: page, div, code, en, uom, ar, note, price,
  saving, p200, pnote). Drop the header row.
- Write `build/offer.json` from `job.json` (tag, dates, kicker, look, paths).
- Inventory: row count, sections found, currency per section, blanks, duplicates, missing prices,
  added/removed items, items with no photo match yet (quick filename search).
- Review: inventory table as `review/intake/r1/inventory.html` (simple styled table), plus questions.

## 2. images

- Match each code to a photo: reuse `build/img/<slug>.png` if it exists in the library of cut-outs,
  otherwise search the photo library (by brand/name words from the English description) and add a line
  to `build/image_map.json` (`"<relative source path>": "<slug>"`).
- `python build/prep_new.py` → cut-outs in `img/` (800 px), `img_pdf/` (560 px), `canvas_assets/` (webp 640 px).
- Check each photo against its item: size/weight on pack vs sheet UOM, flavour, brand. Library file names
  can be swapped.
- Multi-flavour items need one photo per flavour. Multipacks reuse the pack photo (dup).
- Review: contact sheet (`review/images/r1/contact.png`, every card's photos labelled with code + Arabic
  name) and a list of missing / low-res / wrong-size photos for the client.

## 3. cards

- Write `build/cards2.py`: `C(cat, codes, ar, en, unit, img, var, per, dup, from_, save_txt)`.
  - Same price variants → one card with all flavour photos. Different prices → separate cards, or one
    "ابتداءً من" card (`from_=True`) when they belong together.
  - `dup=2/3` multipacks, `save_txt` for a client's fixed saving line, `per="200"` to show the 200 g price.
- Assign sections (`build/sections.json`, defaults in the playbook §5 Phase 3). Drop empty sections.
- Apply every rule in `diwan-brand-rules` (names, wording, savings).
- Review: `review/cards/r1/cards.html` table (section, AR, EN, unit, price, saving shown, photo thumbs,
  codes) + counts (cards, SKUs vs sheet SKUs).

## 4. flyer

- Load the week's look skill and apply it (`build/themes/<look>.css`, optional cover override).
- `python build/build_full.py` → `flyer.html`
- `node build/render.js <build> 1 flyer` → `out/flyer-N.png`
- `node build/check.js <build>` → must show no overflow and the same title-to-bottom on every page.
- Make a contact sheet of all pages and look at it. Then run `diwan-design-review`; fix what it finds.
- Review: every page PNG (label "NN · section"), preview PDF, check output.

## 5. exports

- `node build/render_final.js <build>` → `final/png/Diwan-<TAG>_NN.png` (2160×2700) + Chrome PDF.
- `python build/flatten_pdf.py` → `_Interactive.pdf` flattened, links copied. Always ship the flattened one.
- Verify: page count, internal + web link counts > 0, file opens.
- `python build/mobile_build.py` → `Diwan-<TAG>_Mobile.html` (standalone). Check light background in dark
  mode, chips scroll to sections, search matches word starts only (render in Playwright at 390×844 with
  `colorScheme: 'dark'` and screenshot).
- Review: PDF, mobile screenshots (light + "dark" device), the mobile HTML itself.

## 6. social

- `python build/build_social.py` → `social.html`; `node build/render.js <build> 1 social`.
- Max 20 slides (cover + 19). Merge small sections onto shared slides titled by what's on them; if still
  over, split into two posts, each with the cover first.
- Cover label "اسحب وشوف كل العروض / Swipe for all offers". Each slide exactly 1080×1350.
- Caption: Lebanese Arabic first, short, no items or prices, dates, "حمّل تطبيق ديوان… الرابط بالبايو",
  توفير بطووول!, then English, then `#ديوان_ماركت #توفير_بطووول #DiwanMarket`. Write `review/social/r1/caption.txt`.
- Zip slides → `final/Diwan-<TAG>_Carousel.zip`.

## 7. video

- `python build/build_169.py` → `slides169.html` + `slides169.json`;
  `node build/render169.js <build> 1.3333333333` → 1920×1080 PNGs.
- `python build/make.py` → `Diwan-<TAG>_Slideshow.mp4`: 5 s per slide, 0.7 s transitions (index→first
  `circlecrop`, same section `slideright`, new section `coverright`, →app `fadeblack`), fade in/out,
  `libx264 -preset veryfast -crf 18 -r 30 -an -movflags +faststart`. No cross-fades.
- Spot-check 3 frames mid-transition (ffmpeg `-ss`), include them in the review.
- Zip slides → `final/Diwan-<TAG>_16x9_Slides.zip`.

## 8. delivery

- Copy every final file to `D:\Diwan\Claude outputs\<TAG>\` (create it). Don't overwrite an existing
  file with a different size without saying so.
- Run the QA checklist from the playbook §7 one last time across all outputs (greps in `diwan-brand-rules`).
- Promote new cut-outs from `build/img*` to the app's `toolkit/img*` so next week can reuse them.
- Review: list of delivered files with sizes, QA results, open questions for the client.
