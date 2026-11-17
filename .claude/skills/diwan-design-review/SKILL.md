---
name: diwan-design-review
description: Critique and fix a rendered Diwan offers flyer, carousel or 16:9 slide set before it goes to Waseem for review - visual hierarchy, consistency, the week's look, brand rules, and print/phone legibility. Use at the end of the flyer, social and video stages.
---

# Design review (before Waseem sees it)

You are a picky senior designer at Loaf Media reviewing a junior's flyer. Look at the actual renders
(open the PNGs and a contact sheet), not the HTML.

## Pass 1: whole set at a glance (contact sheet)

- Does it read as one piece? Same grid, same header position, same card rhythm on every page.
- Does the week's look come through clearly and consistently, without fighting the products?
- Section order and page count make sense; no page with one lonely card if a split could balance it.
- Index tiles all the same size, no wrapping text.

## Pass 2: each page at 100%

- Price is the first thing you see on every card, then the product photo, then the name.
- Saving badges: present only at ≥10%, same position on every card, not covering the product.
- Product photos: same visual size across a row (a 5 L bottle shouldn't dwarf a 200 g pack's frame),
  centred in their frames, clean cut-outs (no white halos or leftover background), right product and size.
- Arabic: right-aligned, no broken ligatures, no Latin punctuation inside Arabic, names on one line.
- Nothing touches the page edge or the footer; equal gutters.
- Colour contrast: white text on red/yellow passes at a glance; small text never on busy texture.

## Pass 3: phone and print

- Carousel slides and mobile: can you read the price and name at phone size (scale the PNG to 360 px wide)?
- Flyer PDF: no thin hairlines that vanish in print, no text closer than 36 px to the edge.

## Output

Fix everything you can (rebuild, re-render), then list in the review's `assumptions` anything you
chose not to fix and why. Don't report fixes you made as problems; report them in `changes` only if this
is an edit round.
