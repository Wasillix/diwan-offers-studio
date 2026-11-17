---
name: diwan-look-editorial
description: Calm, premium editorial look for Diwan offers - generous whitespace, thin ink rules, large red numerals, products on soft halo circles, magazine-style section openers. Use when the week's look is "editorial", for gourmet, dairy/cheese, imported or premium-range offers.
---

# Look: Editorial

Like a food magazine spread. Confident through restraint: fewer colours, more air, big typography.

## Character

- Page: halo `#F0ECE5`. Cards lose their boxes: transparent background, a **1 px ink rule** under each card
  instead of borders, product on a **soft white circle** (halo) so cut-outs float.
- Prices: Myriad numerals in **red `#A12222`**, large, currency small and raised. No shapes behind them.
- Saving: small ink text line above the price ("وفّر 18%") instead of a disc, or a thin-outline pill.
- Section headers: Madani Extra Bold section title large, English below in Myriad letter-spaced caps,
  a thin red rule and a section number ("02 / 09") in Myriad.
- Yellow used once per page at most (date sticker only).

## Implementation

Write `build/themes/editorial.css` (check selectors; never set font-size on `.card h3` / `.card .en`):

```css
body.look-editorial section.page{background:var(--halo)}
body.look-editorial .card{background:transparent;box-shadow:none;border:0;border-bottom:1px solid var(--ink);border-radius:0}
body.look-editorial .card .imgs{background:radial-gradient(circle at 50% 55%,#fff 0 58%,transparent 59%)}
body.look-editorial .price{color:var(--red);font-family:"Myriad"}
body.look-editorial .save{position:static;width:auto;height:auto;border-radius:20px;background:transparent;
  color:var(--ink);border:1px solid var(--ink);padding:4px 12px}
body.look-editorial .head .title h2{letter-spacing:0}
body.look-editorial .head .title p{font-family:"Myriad";text-transform:uppercase;letter-spacing:.22em}
body.look-editorial .head{border-bottom:2px solid var(--red);padding-bottom:12px}
body.look-editorial .banner{background:var(--ink)}
```

Cover: one hero product large on a halo circle, offer kicker as a big two-line Arabic headline, dates and
branches set like a magazine masthead strip along the bottom.

## Vary week to week

Halo circle vs soft rounded square behind products; red vs ink prices; section numbers on/off;
masthead strip at top vs bottom.

## Watch out

- With no card boxes, alignment errors show more. `check.js` title-to-bottom must be identical per page.
- Thin rules must survive print: 1 px at 1080 is fine for screen; for the 2x PDF they render at 2 px.
- Prices must still be the first thing you see on each card.
