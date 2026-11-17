# Review contract

End every stage and every edit round by writing `review/<stage>/review.json`, overwriting the previous one
(earlier rounds stay in `review/<stage>/r<n>/`). The Studio reads only this file. If it's missing or invalid,
the stage shows as failed.

```json
{
  "stage": "flyer",
  "round": 2,
  "summary": "One or two sentences: what's ready and anything notable.",
  "changes": ["Round 2+: what you changed, one line per edit, with page/item"],
  "files": [
    {"path": "review/flyer/r2/page-01.png", "kind": "image", "label": "01 · Index"},
    {"path": "review/flyer/r2/flyer.pdf", "kind": "pdf", "label": "Preview PDF"},
    {"path": "review/social/r1/caption.txt", "kind": "text", "label": "Caption"},
    {"path": "review/video/r1/slideshow.mp4", "kind": "video", "label": "Slideshow"},
    {"path": "review/exports/r1/mobile.html", "kind": "html", "label": "Mobile page"},
    {"path": "review/cards/r1/cards.json", "kind": "table", "label": "Card list"}
  ],
  "checks": {"overflow": 0, "alignment": "ok", "cards": 61, "skus": 88, "sheet_skus": 88, "slides": 19},
  "questions": [{"id": "q1", "text": "…", "blocking": false}],
  "assumptions": ["…"],
  "rules_added": ["Optional: standing rules you added to diwan-brand-rules this round"],
  "cards_changed": false
}
```

- `path` is relative to the job folder. `kind` is one of image, pdf, text, video, html, table, zip.
- `table` files are JSON: a list of card rows the Studio shows as an editable table, one object per card:
  `{"n": 1, "section": "dairy", "section_ar": "ألبان وأجبان", "ar": "…", "en": "…", "unit": "200 g",
  "price": 3.49, "saving": "15%", "codes": ["DAIRYSRV-001"], "photos": ["build/img/rawabi-halloumi.png"]}`
  (`price` null if missing; `saving` the text shown on the card, "" if no badge; `photos` relative to the job folder).
- `cards_changed`: set `true` in an edit round of `cards` or any later stage when cards, names or prices
  changed. The Studio then rebuilds the approved stages that use the card list (flyer, exports, social, video).
- Images in a gallery are shown in `files` order: name them so they sort (page-01, page-02…).
- `checks` keys are free-form; numbers and short strings only.
- Keep `questions` ids stable across rounds (q1 stays q1 until answered).
