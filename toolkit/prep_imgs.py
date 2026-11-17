"""Contact sheet of the cut-outs the week uses, labelled, for the images review.

python prep_imgs.py [out.png]   -> default review/contact.png next to this script.
Lists every image referenced in cards2.py (and the section index images); missing files show in red.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
import offer
from cards2 import CARDS

out = sys.argv[1] if len(sys.argv) > 1 else offer.path("review", "contact.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
items = []
for c in CARDS:
    for x in c["img"] or [None]:
        items.append((x, f'{c["codes"][0]} · {c["en"]}'[:34]))
for s in offer.SECTIONS:
    items.append((s["img"], f'index · {s["key"]}'))

cols, cw, lh = 8, 190, 34
rows = (len(items) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * (cw + lh)), (236, 232, 226))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype(offer.path("fonts", "MyriadPro-Regular.otf"), 13)
except OSError: font = ImageFont.load_default()
missing = []
for i, (name, label) in enumerate(items):
    x, y = (i % cols) * cw, (i // cols) * (cw + lh)
    p = offer.path("img", name) if name else None
    if p and os.path.exists(p):
        im = Image.open(p).convert("RGBA"); im.thumbnail((cw - 16, cw - 16))
        sheet.paste(im, (x + (cw - im.width) // 2, y + (cw - im.height) // 2), im)
        col = (17, 17, 17)
    else:
        d.rectangle([x + 8, y + 8, x + cw - 8, y + cw - 8], outline=(220, 32, 39), width=3)
        missing.append(name or label); col = (220, 32, 39)
    d.text((x + 6, y + cw + 2), label, fill=col, font=font)
    d.text((x + 6, y + cw + 17), (name or "no photo")[:30], fill=(110, 106, 102), font=font)
sheet.save(out)
print("contact sheet", out, "| photos", len(items), "| missing", len(missing))
for m in missing: print("MISSING", m)
