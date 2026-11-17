---
name: diwan-look-classic
description: Diwan offers flyer in the established house look (red banners, paper cards, ink saving discs) - the safe choice for regular weekend/weekly offers or when the client wants consistency. Use when the week's look is "classic".
---

# Look: Classic (house style)

The look the client has already approved across past offers. Use it when the week's look is `classic`,
or as the base the other looks build on.

## Character

Clean supermarket clarity. Paper `#F5F5F2` page, white cards with fixed image frames, red→signal radial
banners, ink `#111` circular saving discs, yellow `#EDC11C` date sticker. Nothing decorative competes with
prices.

## Implementation

- `build/themes/classic.css` stays empty. The base `style.css + style_full.css` is the classic look.
- Default cover from `build_full.py`.

## Small weekly variations (so two classic weeks don't look identical)

Pick one or two, note them in the review summary:
- Banner gradient direction (`at 0% 0%` vs `at 100% 0%`).
- Index tile images: use a different hero product per section (the best-saving item that week).
- Cover hero: the week's biggest saving item, larger, with the sticker overlapping it.
- Free slots stay empty by default (client rule). Use a `card.promo` variant (`alt`, `ink`) in a free
  slot only if the client asks for it.

## Carries to

Carousel, 16:9 and mobile use the same classes, so they follow automatically.
