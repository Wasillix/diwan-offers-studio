"""Cut out new product photos from the photo library.

image_map.json (written by the agent in the images stage): {"<path relative to IMAGE_LIBRARY>": "<slug>", ...}
For each photo: knock out a white background (if it has no transparency), crop, and save
  img/<slug>.png          800 px  (flyer, carousel, slides, mobile)
  img_pdf/<slug>.png      560 px  (PDF export)
  canvas_assets/<slug>.webp 640 px (Design canvas)
The photo library itself is never written to.
"""
import os, sys
from PIL import Image
from collections import deque
import offer

R = offer.IMAGE_LIBRARY
M = offer.load_json("image_map.json") if os.path.exists(offer.path("image_map.json")) else {}
OUTS = [("img", 800, "png"), ("img_pdf", 560, "png"), ("canvas_assets", 640, "webp")]
for d, *_ in OUTS: os.makedirs(offer.path(d), exist_ok=True)


def knock(im, th=238):
    """Flood-fill from the edges, making near-white pixels transparent (keeps white inside the product)."""
    w, h = im.size; px = im.load(); seen = bytearray(w * h); q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft(); i = y * w + x
        if seen[i]: continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if a < 10 or min(r, g, b) > th:
            px[x, y] = (r, g, b, 0)
            if x > 0: q.append((x - 1, y))
            if x < w - 1: q.append((x + 1, y))
            if y > 0: q.append((x, y - 1))
            if y < h - 1: q.append((x, y + 1))
    return im


if __name__ == "__main__":
    if not M: print("image_map.json is empty or missing: nothing to cut out")
    missing = 0
    for src, slug in M.items():
        p = os.path.join(R, src)
        if not os.path.exists(p): print("MISSING", src); missing += 1; continue
        im = Image.open(p); im.load(); im = im.convert("RGBA")
        if im.getchannel("A").getextrema()[0] == 255:
            im.thumbnail((1600, 1600)); im = knock(im); note = "knocked"
        else: note = "alpha"
        bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        if bb: im = im.crop(bb)
        src_size = im.size
        for d, size, fmt in OUTS:
            out = im.copy(); out.thumbnail((size, size), Image.LANCZOS)
            if fmt == "png": out.save(offer.path(d, f"{slug}.png"), optimize=True)
            else: out.save(offer.path(d, f"{slug}.webp"), quality=86)
        low = " LOW-RES" if max(src_size) < 500 else ""
        print(slug, src_size, note + low)
    sys.exit(1 if missing else 0)
