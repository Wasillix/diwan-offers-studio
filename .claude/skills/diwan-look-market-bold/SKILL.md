---
name: diwan-look-market-bold
description: High-energy supermarket look for Diwan offers - yellow price bursts, diagonal red header bands, halftone texture, sticker-style saving badges. Use when the week's look is "market-bold", for big-saving weekends, mega sales, White/Black Friday-type pushes.
---

# Look: Market Bold

Loud, confident, souk energy. Feels like a big sale, still tidy. For big-saving weeks.

## Character

- Prices sit on **yellow starburst** shapes (`#EDC11C`, ink text), slightly rotated (−4° to 4°, vary per card
  by index so it feels hand-stuck but stays legible).
- Section headers on a **diagonal red band** (`#DC2027` → `#A12222`) that bleeds off the right edge
  (RTL start), section title in white Madani Extra Bold, English in Myriad caps.
- **Halftone dot texture** on the page background (radial-gradient dots, ink at 6–8% opacity), never under
  card content.
- Saving badge as a **rotated sticker** (rounded rectangle, ink background, yellow text "وفّر 15%").
- Cards: white, 3 px ink outline, 18 px radius, small offset ink shadow (6px 6px 0 #111) for a print-poster feel.

## Implementation

Write `build/themes/market-bold.css`. Starter (check selectors against `style.css` / `style_full.css`
and adjust; do **not** set font-size on `.card h3` or `.card .en`):

```css
body.look-market-bold section.page{background:
  radial-gradient(rgba(17,17,17,.07) 1.2px, transparent 1.4px) 0 0/14px 14px, var(--paper)}
body.look-market-bold .card{border:3px solid var(--ink);box-shadow:6px 6px 0 var(--ink);border-radius:18px}
body.look-market-bold .price{position:relative;z-index:1;color:var(--ink)}
body.look-market-bold .price::before{content:"";position:absolute;inset:-14px -18px;z-index:-1;background:var(--yellow);
  clip-path:polygon(50% 0,61% 12%,77% 5%,80% 21%,96% 22%,89% 37%,100% 50%,89% 63%,96% 78%,80% 79%,77% 95%,61% 88%,50% 100%,39% 88%,23% 95%,20% 79%,4% 78%,11% 63%,0 50%,11% 37%,4% 22%,20% 21%,23% 5%,39% 12%)}
body.look-market-bold .save{border-radius:12px;background:var(--ink);color:var(--yellow);transform:rotate(-8deg)}
body.look-market-bold .head{position:relative}
body.look-market-bold .head::before{content:"";position:absolute;right:-60px;top:-10px;width:70%;height:110%;
  background:linear-gradient(100deg,var(--signal),var(--red));transform:skewX(-12deg);z-index:0}
body.look-market-bold .head .title{position:relative;z-index:1;color:#fff}
```

Per-card rotation: add `style="--r:Ndeg"` in `build_full.py`'s card() via a theme hook, or use
`:nth-child()` rules. Keep rotation ≤ 4° on prices.

Cover: big stacked Arabic headline ("عروض نار" style, but use the week's kicker), three hero products
overlapping on a burst, the date as a ticket-stub sticker.

## Vary week to week

Burst colour (yellow / white on red), band angle (−8° to −14°), texture (dots / diagonal lines), shadow on/off.

## Watch out

- Busy is fine, unreadable is not: run `diwan-design-review` pass 3 (phone size) carefully.
- Bursts must not cover the product photo or the saving badge.
- Keep the app banner and index readable: no texture behind small text.
