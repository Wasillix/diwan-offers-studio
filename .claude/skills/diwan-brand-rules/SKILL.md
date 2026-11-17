---
name: diwan-brand-rules
description: The Diwan Market client's standing rules for offers flyers - layout limits, Arabic wording, price and saving display, CTA, item-name glossary, and the QA greps. Load before any Diwan stage, and update it when the client sets a new rule or corrects a name.
---

# Diwan brand rules (never break these)

These come from client feedback across past offers. Design looks may change colour, texture and
composition, but nothing in this file. When the client adds a rule or corrects a name, add it here
(keep the same table/list style) and note it in the review's `rules_added`.

## Layout (locked)

- Flyer page 1080×1350 (4:5). Max **6 cards per page**: 6 → 3+3, 5 → 3+2, 4 → 2+2, 3 → 2+1.
- Uniform card alignment, fixed image frames. Leave empty space instead of filler tiles.
- Card title **23.4 px**, description **19.7 px** (on the 1080-wide page). Never shrink; shorten the name.
- Fonts: Madani Arabic (Bold / Extra Bold) + Myriad Pro. No other typefaces on product cards.
  Display text on covers/section titles may use the look's treatment, still in these families.
- Page 1 = index: offer title, dates, branches, @diwan.market, a tile per section.
- Last page = app download banner with real App Store + Google Play buttons.
- Carousel max 20 slides, 1080×1350. 16:9 slides 1920×1080, max 4 cards per slide.

## Wording

- Never **ديواني** in product names (house brand): drop it.
- Beef items: **لحم بقر**.
- Frozen: **مثلجات / مثلجة**, never مجلّدات / مجلّدة.
- "Original" flavour: **عادي**, not أصلي.
- No **بلوك** in Arabic cheese names.
- One line per product name: shorten rather than shrink. Natural, local Lebanese Arabic.

## Prices and savings

- No saving badge under **10%**. Round savings **down**.
- Client-given fixed saving line for a group (e.g. "وفّر حتى 20%") replaces the computed saving on every card in that group.
- Different-price variants on one card → **ابتداءً من** + lowest price.
- Same-price variants → one card showing all flavour photos.
- Multipacks repeat the pack photo back to back (x2, x3).
- Currency after the number: `12.99$` / `44.999L.L.`. L.L. only on produce.

## Brand and CTA

- **No Diwan Privé**, **no QR code** unless the client asks again.
- No website on the flyer. Social: `@diwan.market` (Instagram + Facebook).
- App links:
  - App Store `https://apps.apple.com/lb/app/diwan-hypermarket/id1506406651`
  - Google Play `https://play.google.com/store/apps/details?id=com.scopeexperts.diwan_hypermarketapp&hl=en`
- Branches (index page): الشويفات · طرابلس (البداوي) · النويري · الحمرا · الطريق الجديدة
- Mobile HTML stays light: background `#F0ECE5`, `color-scheme: only light`.
- Core colours (every look keeps these recognisable): red `#A12222`, signal red `#DC2027`,
  yellow `#EDC11C`, ink `#111111`, paper `#F5F5F2`, halo `#F0ECE5`.

## Item name glossary

| Item | Use | Not |
|---|---|---|
| Minced chicken escalope | اسكالوب دجاج مدقوق | مفروم |
| Clementine | كلمنتين | — |
| Eggplant (round) | باتنجان مدعبل | — |
| Red kidney beans | عايشة خانوم حمرا | — |
| Beef kafta / burger / minced / sojok | كفتة لحم بقر · برغر لحم بقر · لحم بقر مفروم · سجق لحم بقر | ديواني … بقر |
| Frozen mango (and other frozen fruit) | مثلجة | مجلّدة |

## QA greps (run on every HTML output before submitting)

Must find nothing: `ديواني`, `مجلّد`, `مجلد`, `أصلي`, `بلوك`, `Privé`, `Prive`, `QR`, `qr-`.
Must find: the week's `dates_ar` and `dates_en` on the cover/index, closing page, caption and closing slide;
`@diwan.market`; both app links.
Counts: cards in HTML == cards in `cards2.py`; SKUs on cards == SKUs in the sheet (minus removed items).
