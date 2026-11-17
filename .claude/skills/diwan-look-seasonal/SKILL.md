---
name: diwan-look-seasonal
description: Occasion-themed look for Diwan offers that adapts to the season or holiday in the offer name and dates (Ramadan, Eid, Christmas and New Year, Independence Day, Mother's Day, back to school, summer, White Friday). Use when the week's look is "seasonal" or the offer is a seasonal campaign.
---

# Look: Seasonal

A themed flyer for a moment in the calendar, built on the classic structure. The theme lives in the
background, cover and section headers; product cards stay clean.

## Pick the theme

From the offer name first, then the dates. If unclear, pick the most likely and list it in `assumptions`.

| Occasion | Mood | Motifs (drawn in CSS/SVG, subtle) | Palette shift |
|---|---|---|---|
| Ramadan | Calm, warm nights, generosity | Crescent line, lantern (fanous) outlines, 8-point star geometric border | Deep ink-red night `#3a0d0d`→`#A12222` banners, yellow as warm light |
| Eid al-Fitr / al-Adha | Joyful, family, sweets | Geometric star pattern, confetti of small 8-point stars, ribbon | Signal red + yellow, more yellow than usual |
| Christmas / New Year | Festive, gifting | Ribbons, simple snowflakes, sparkles, gift-tag stickers for savings | Red-led, paper white, tiny touches of yellow as gold |
| Independence Day (22 Nov) | Proud, local | Cedar line illustration, subtle; no flag reproductions | Red + white, ink accents |
| Mother's Day (21 Mar) | Warm, tender | Flower line art, handwritten-feel section numbers | Softer red, more halo/paper |
| Back to school | Bright, practical | Notebook ruled lines, pencil underline under section titles | Yellow-led |
| Summer | Fresh, cold drinks, BBQ | Sun rays, wave line, ice-cube highlights on drinks section | Yellow + signal red |
| White Friday | Urgent, big deals | Bold numerals, countdown-style date sticker, strike-through old-price feel | Ink-led with signal red, like market-bold but darker |

Respect the occasion: no religious text or calligraphy of sacred phrases on a sales flyer, no mosque or
church imagery behind prices. Greetings are fine in plain text ("رمضان كريم", "عيد مبارك", "ميلاد مجيد").
Ask in `questions` (non-blocking) if a greeting should appear on the cover.

## Implementation

- `build/themes/seasonal.css` with a `--motif` SVG data URI and the palette overrides scoped to
  `body.look-seasonal`. Motif opacity ≤ 10% on pages, up to 30% on the cover and banners.
- Optional `build/themes/seasonal_cover.py` (`cover_html(bf)`) for a themed cover: greeting line, kicker,
  dates, hero products, motif framing.
- Section headers: the motif as a small ornament next to the title (e.g. a crescent or star), same on every page.
- Draw motifs yourself as simple SVG paths. No downloaded clip art, no copyrighted characters.

## Vary year to year

Keep a note in the review summary of which motif set and palette you used, so next year's Ramadan or
Christmas flyer can differ.

## Watch out

- Motifs never sit behind prices, names or saving badges.
- Index tiles and the app banner keep their classic layout; only colour and ornament change.
- Carousel cover gets the strongest theme treatment; offer slides stay calm.
