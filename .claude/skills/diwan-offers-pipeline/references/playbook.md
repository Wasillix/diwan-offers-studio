# Diwan Market – Offers Flyer: Production Playbook

The standard process for producing a Diwan Market offers flyer (weekend, weekly or seasonal), from the client's offer sheet to the PDF, mobile page, social carousel and slideshow video.

**Client:** Diwan Market · **Agency:** Loaf Media
**Toolkit:** `D:\Diwan\Claude outputs\Pipeline\` (scripts, styles, fonts and the library of cut-out product images, plus this playbook)

Placeholders used below: `<DATES_AR>` / `<DATES_EN>` = offer dates, `<TAG>` = short file tag (e.g. `Weekend-6-9Nov`), `<N>` = a count that depends on that offer.

---

## 1. Flow at a glance

```
INTAKE ──► DATA ──► IMAGES ──► CARDS ──► FLYER ──► EDIT ROUNDS ──► EXPORTS ──► SOCIAL ──► VIDEO ──► DELIVERY
 sheet +    clean     match +     group     4:5 pages  client         PDF, PNG,    carousel   16:9 slides  zips to
 images     sheet,    cut out     into      6 cards    feedback       mobile       (≤20) +    + MP4        D:\Diwan\
 + dates    check     each item   cards     max        loop           HTML,        caption                 Claude outputs
            prices                                                    canvas
```

- Each stage only starts once the one before it is approved.
- Most of the time goes into the edit-round loop, so get the sheet and images right first.
- The flyer is the master. The PDF, mobile page, canvas, carousel and 16:9 slides are all built from the same card list, so a fix made once flows to every format.

---

## 2. Deliverables

| # | Deliverable | Spec | File name | Goes to |
|---|---|---|---|---|
| 1 | **Interactive PDF** | All flyer pages at 1080×1350, flattened to images; category jumps, store buttons and social links still clickable | `Diwan-<TAG>_Interactive.pdf` | D:\Diwan\Claude outputs |
| 2 | **Flyer PNGs** | One per page, 2160×2700 (2x) | `Diwan-<TAG>_01…NN.png` | Final folder |
| 3 | **Mobile HTML** | One standalone file with nothing external (fonts and images embedded); light background on all phones; tappable category chips; search | `Diwan-<TAG>_Mobile.html` | D:\Diwan\Claude outputs + published artifact |
| 4 | **Editable Design canvas** | Every flyer page as an editable board | Artifact "Diwan <offer name> <dates>" | claude.ai artifact |
| 5 | **Instagram carousel** | One post, **max 20 slides**, 1080×1350; cover + offer slides, max 6 cards each, every item kept | `Diwan-<TAG>_01…NN.png` + `_Carousel.zip` | D:\Diwan\Claude outputs |
| 6 | **Social caption** | Short Lebanese Arabic caption with English below; no items or prices; dates + app CTA + hashtags | In chat (copy-paste) | — |
| 7 | **16:9 slides** | 1920×1080; index slide, offer slides with up to 4 cards each, closing app slide | `Diwan-<TAG>_16x9_01…NN.png` + `_16x9_Slides.zip` | D:\Diwan\Claude outputs |
| 8 | **Slideshow video** | MP4, 1920×1080, 30 fps, H.264, no audio, 5 s per slide, push/cover transitions | `Diwan-<TAG>_Slideshow.mp4` | D:\Diwan\Claude outputs |

Check with the client which of these each offer needs. Short offers may only need the carousel and video.

---

## 3. What has to be provided (intake checklist)

Collect all of this **before** starting. Missing inputs cause extra edit rounds.

- [ ] **Offer sheet (Excel)** from Diwan. Standard columns:
  `Page · Division · Diwan Item Number · English Description · UOM · Arabic Description · Marketing Comment (Added / Removed) · New RRP TTC · Customer Saving · Price In 200G`
  - "Customer Saving" is a negative fraction (−0.147 = 14%).
  - Prices in USD, except produce (FRV) in **L.L.**
- [ ] **Produce price list**, if produce is in the offer (often a separate Excel) with LBP prices and savings.
- [ ] **Offer dates** in Arabic and English (`<DATES_AR>` / `<DATES_EN>`).
- [ ] **Offer name / theme** (Weekend Offers, Weekly Deals, a seasonal campaign) for the cover title and file names.
- [ ] **Product images:** isolated photos in `D:\Diwan\005 - FMCG Items\001 - Isolated Items\<Category>\…`
  - New SKUs need new photos. Multi-flavour items need one photo per flavour.
  - Multipacks (x2, 6-pack) are shown by repeating the pack photo.
- [ ] **Added / removed items** (Marketing Comment column, or a separate list).
- [ ] **App store links** (current; confirm they haven't changed):
  - App Store: `https://apps.apple.com/lb/app/diwan-hypermarket/id1506406651`
  - Google Play: `https://play.google.com/store/apps/details?id=com.scopeexperts.diwan_hypermarketapp&hl=en`
- [ ] **Social handle:** `@diwan.market` (Instagram + Facebook). No website on the flyer.
- [ ] **Branch list for the index page:** الشويفات · طرابلس (البداوي) · النويري · الحمرا · الطريق الجديدة. Confirm no branch has opened or closed.
- [ ] **Device link:** the desktop app is linked with `D:\Diwan` connected, so images can be staged and outputs written back.

---

## 4. Standing rules (apply to every offer)

These come from client feedback. Add new standing rules here as they come up.

**Layout**
- Max **6 cards per page** (grid 3+3; 5 → 3+2; 4 → 2+2; 3 → 2+1).
- Uniform card alignment and fixed image frames. Leave empty space rather than adding filler tiles.
- Card title **23.4 px**, description **19.7 px** (on the 1080-wide page).
- Flyer page 1080×1350 (4:5). Fonts: Madani Arabic + Myriad Pro, as in Diwan's existing offer layouts.
- Page 1 is the index: offer title, dates, branches, social handle and a tile per section.
- The last page has the app download banner with real App Store and Google Play buttons.

**Wording**
- Never use **ديواني** (the house brand name) in product names; drop it.
- Beef items read **لحم بقر**.
- Frozen is **مثلجات / مثلجة**, never مجلّدات / مجلّدة.
- "Original" flavour is **عادي**, not أصلي.
- No **بلوك** in Arabic cheese names.
- Product names fit on one line: shorten the name rather than shrinking the type.
- Keep the Arabic natural and local; the item glossary in Section 9 lists names the client has already corrected.

**Prices and savings**
- No saving badge under **10%**. Savings are rounded down.
- When the client gives a fixed saving line for a group (e.g. a supplier's frozen range "وفّر حتى 20%"), use that text on every card in the group instead of the computed saving.
- Variants with different prices go on one card showing **ابتداءً من** and the lowest price.
- Variants with the same price share one card that shows all the flavour photos.
- Multipacks repeat the pack photo back to back (x2, x3).
- Currency follows the number: `12.99$` / `44.999L.L` (no closing dot)

**Brand and CTA**
- **No Diwan Privé** and **no QR code** unless the client asks for them again.
- Mobile HTML stays **light** (`#F0ECE5` background, `color-scheme: only light`) even when the phone is in dark mode.

---

## 5. Step-by-step flow with tasks

Copy this checklist for each offer and tick boxes as you go. **[D]** = deliverable produced in that step.

### Phase 1: Intake and data inventory
- [ ] Receive the offer sheet, produce prices, dates, offer name and new images.
- [ ] Inventory the sheet: row count, sections, currency (USD vs L.L.), blanks, duplicates, missing prices, items with no image.
- [ ] Ask the client about anything that blocks the work (missing prices, unclear flavours or sizes). Assume and flag everything else.
- [ ] Convert the sheet to `items2.json` (one row per Diwan item number).

### Phase 2: Images
- [ ] Match every item code to a photo in the library; reuse cut-outs already in the toolkit's `img/` folder.
- [ ] Stage the new photos from `D:\Diwan\005 - FMCG Items\001 - Isolated Items\`.
- [ ] Cut them out (`prep_new.py` → `knock()`) and save each to:
  - `img/<slug>.png` at 800 px
  - `img_pdf/<slug>.png` at 560 px
  - `canvas_assets/` as webp at 640 px
- [ ] Check that each photo matches its item: library file names can be swapped or out of date.
- [ ] Send the client a list of **missing, low-res or wrong-size** photos (e.g. a photo showing 400 g when the offer is 600 g).

### Phase 3: Cards and sections
- [ ] Group items into cards in `cards2.py`: `C(cat, codes, ar, en, unit, img, var, per, dup, from_, save_txt)`.
  - Different prices = separate cards (or one "ابتداءً من" card if the client wants them combined).
  - Same price = one card with all the flavours.
  - `dup=2/3` for multipacks; `from_=True` for "starting from"; `save_txt` for a fixed saving line.
- [ ] Assign each card to a section. Default sections (add or drop sections to fit the offer):

| Key | Index tile | Page title |
|---|---|---|
| meat | لحوم ودجاج | اللحوم والدجاج · Meat & Poultry |
| produce | خضار وفواكه | الخضار والفواكه · Fruits & Vegetables |
| dairy | ألبان وأجبان | الألبان والأجبان · Dairy & Cheese |
| pantry | المونة | المونة والمطبخ · Pantry Essentials |
| bread | خبز وراب | الخبز والراب · Bread & Wraps |
| healthy | سناك صحّي | سناك صحّي · Healthy Snacks |
| snacks | بسكويت ومشروب | بسكويت ومشروبات · Biscuits & Drinks |
| frozen | المثلجات | المثلجات · Frozen Food |
| home | تنظيف وبيت | التنظيف والبيت · Home & Cleaning |

### Phase 4: Flyer build and QA
- [ ] Set the offer name, dates and file tag in `build_full.py` (`DATES_AR`, `DATES_EN`, cover title, output names) and `mobile_build.py`.
- [ ] `python3 build_full.py` → `flyer.html`.
- [ ] `node render.js <dir> 1 flyer` → preview PNGs.
- [ ] `node check.js <dir>` → no text overflow, and the same title-to-bottom alignment on every page.
- [ ] Review every page by eye on a contact sheet before sending.
- [ ] Send the preview for review.

### Phase 5: Client edit rounds (repeat until approved)
- [ ] Collect the edit list (wording, prices, images, merges/splits, items added or removed).
- [ ] Apply the edits to `cards2.py` / `items2.json`, rebuild, re-check and re-send.
- [ ] Add any new standing rule to Section 4 and any corrected item name to Section 9.

### Phase 6: Final exports **[D1–D4]**
- [ ] `node render_final.js <dir>` → `final/png/*.png` at 2x + Chrome PDF.
- [ ] `python3 flatten_pdf.py` → flattened PDF with the links kept. **Always ship the flattened version**: Chrome's live-text PDF overlaps text in Acrobat, Illustrator and print.
- [ ] Check the PDF: correct page count, internal and web links work, opens cleanly.
- [ ] `python3 mobile_build.py` → standalone mobile HTML + `mobile_artifact.html`.
- [ ] Test the mobile page on a phone-sized viewport:
  - light background in dark mode;
  - chips scroll to their section;
  - search matches word starts only.
- [ ] Publish or republish the mobile artifact.
- [ ] Publish or republish the Design canvas (`to_canvas.py`). Read the live canvas first and only republish the boards that changed.

### Phase 7: Social carousel **[D5–D6]**
- [ ] `python3 build_social.py` → `social.html`.
- [ ] `node render.js <dir> 1 social` → PNGs at exactly 1080×1350.
- [ ] Fit the 20-slide limit: **Instagram allows max 20 slides per post** (cover + 19).
  - If the sections need more than 19 slides, put small sections together on full slides, each titled after what it holds (e.g. "خبز وسناك صحّي").
  - If they still don't fit, split into two posts, each with the cover first.
- [ ] Change the cover label to "اسحب وشوف كل العروض / Swipe for all offers".
- [ ] Remember the store buttons can't be tapped in a post: put the links in the caption or bio.
- [ ] Zip the slides → `_Carousel.zip`.
- [ ] Write the caption:
  - Lebanese Arabic first, short, **no items or prices**;
  - the offer dates;
  - "حمّل تطبيق ديوان… الرابط بالبايو" (on Facebook, put the actual links);
  - توفير بطووول!;
  - hashtags `#ديوان_ماركت #توفير_بطووول #DiwanMarket`.

### Phase 8: 16:9 slides and video **[D7–D8]**
- [ ] `python3 build_169.py` → `slides169.html`.
- [ ] `node render169.js <dir> 1.3333333333` → 1920×1080 PNGs (laid out at 1440×810, rendered at 4/3).
  - Slide 1 is the index (section tiles, title, dates, branches).
  - Offer slides hold up to 4 cards. Sections are split evenly, so a slide may have 3 cards rather than a lone 1.
  - The last slide is the app download slide.
- [ ] Zip the slides → `_16x9_Slides.zip`.
- [ ] `python3 make.py` (ffmpeg `xfade`) → MP4 with 5 s per slide and 0.7 s transitions:
  - index → first: `circlecrop`
  - same section: `slideright` (push, follows Arabic reading direction)
  - new section: `coverright`
  - → app slide: `fadeblack`
  - fade in at the start and out at the end
  - Avoid cross-fades: identical layouts show two sets of prices at once.
  - Encode with `libx264 -preset veryfast -crf 18 -r 30 -an -movflags +faststart`.
- [ ] Spot-check frames mid-transition.

### Phase 9: Delivery
- [ ] Write every final file to `D:\Diwan\Claude outputs\`.
  - Commit in batches of ≤12 files.
  - For files over ~25 MB, send them in chat first, then commit by file id.
- [ ] Send the PDF, mobile HTML, zips and MP4 in chat.
- [ ] Log open questions for the client (Section 10).

---

## 6. Toolkit reference

Copy the toolkit into the session's working `build/` folder. It needs Python 3 (Pillow, pypdf, reportlab, openpyxl), Node + Playwright, and ffmpeg.

| File | Role |
|---|---|
| `items2.json` | The offer sheet as JSON (code → names, UOM, price, saving, price per 200 g) |
| `cards2.py` | **The card list**: the main file to edit for each offer |
| `build_full.py` | Builds `flyer.html` (sections, pages, prices, badges, nav, footer, app banner) |
| `style.css` + `style_full.css` | Flyer styles (later rule blocks override earlier ones) |
| `icons.json`, `logos.py`, `fonts/` | Store and social icons, Diwan logos, Madani Arabic + Myriad Pro |
| `img/`, `img_pdf/` | Library of cut-out product images, built up from previous offers |
| `prep_new.py`, `prep_imgs.py` | Background removal and slug naming for new photos (**update the hardcoded paths in `prep_new.py`**) |
| `render.js` / `check.js` | Preview render / overflow and alignment check |
| `render_final.js` | 2x PNGs + Chrome PDF |
| `flatten_pdf.py` | Flattened PDF with the links copied across |
| `mobile_build.py` | Standalone mobile HTML |
| `to_canvas.py` + `canvas_assets_map.json` | Design canvas boards |
| `build_social.py` / `check_social.js` | Instagram carousel (≤20 slides) |
| `build_169.py` / `render169.js` | 16:9 slides |
| `make.py` | Slideshow MP4 |
| `make_price_sheet.py` | Price-check sheet (Excel) for the client |

Previous offers' artifacts (mobile page, Design canvas) can be updated in place to keep the same link, or published as new artifacts for each offer.

---

## 7. QA checklist (before anything goes out)

- [ ] Every sheet item appears on a card, and the card and SKU counts match the sheet.
- [ ] Every price has the right currency; L.L. where the sheet prices in L.L. (see brand rules), else $.
- [ ] No saving badge under 10%; fixed saving lines appear where the client asked for them.
- [ ] No ديواني, مجلّدات, أصلي, بلوك, Privé or QR anywhere (search the HTML).
- [ ] The dates are correct on every page, the cover, the caption and the closing slide.
- [ ] No text overflow (check script), and every page reviewed by eye.
- [ ] Store buttons link to the right stores; @diwan.market is correct.
- [ ] The PDF is the flattened version; the mobile HTML opens offline.
- [ ] Carousel ≤ 20 slides, each exactly 1080×1350; 16:9 slides exactly 1920×1080.

---

## 8. Known problems and fixes

| Problem | Fix |
|---|---|
| PDF text overlaps in some viewers | Chrome embeds Myriad as a Type 3 font; ship the flattened PDF |
| Mobile page goes black on phones | No dark mode; `color-scheme: only light`; background `#F0ECE5` |
| Category chips don't work on iPhone | JS click handler with `scrollTo` and a `scrollIntoView` fallback |
| Search shows unrelated items | Match word starts only, strip "ال", minimum 2 characters |
| Names overflow after a font change | Shorten the name; never shrink below the locked sizes |
| Index tiles wrap | `.tile{min-width:0;overflow:hidden}` |
| Wrong product photo | Library file names can be swapped; check each photo against its item |
| Carousel over 20 slides | Put small sections together on full slides, or split into two posts |
| Video cross-fades look messy | Push/cover transitions instead |
| Big device writes time out | Batches of ≤12; send big files in chat first, then commit by file id |
| Session files are gone | Session working files don't persist; keep the toolkit on `D:\Diwan` and copy it in at the start |

---

## 9. Item name glossary (carry forward)

Names the client has corrected. Use them whenever these items come back.

| Item | Use | Not |
|---|---|---|
| Minced chicken escalope | اسكالوب دجاج مدقوق | مفروم |
| Clementine | كلمنتين | — |
| Eggplant (round) | باتنجان مدعبل | — |
| Red kidney beans | عايشة خانوم حمرا | — |
| Beef kafta / burger / minced / sojok | كفتة لحم بقر · برغر لحم بقر · لحم بقر مفروم · سجق لحم بقر | ديواني … بقر |
| Frozen mango (and other frozen fruit) | مثلجة | مجلّدة |

Add rows as the client corrects more names.

---

## 10. Open questions log (fill in for each offer)

| Question | Asked | Answer |
|---|---|---|
| | | |

---

## 11. Kickoff prompt

> New offers flyer for Diwan: **<offer name>**, **<DATES_AR> / <DATES_EN>**. Attached: the offer sheet (and the produce price list if produce is included). New images are in `D:\Diwan\005 - FMCG Items\001 - Isolated Items\`. Follow the offers playbook (`Diwan-Weekly-Offers-Playbook.md`, in the project docs and with the toolkit in `D:\Diwan\Claude outputs\Pipeline\`). Start with the data inventory and the missing-images list, then build the flyer preview. After approval: flattened PDF, 2x PNGs, standalone mobile HTML, canvas, carousel (≤20 slides) + caption, 16:9 slides and the MP4.
