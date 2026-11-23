# Studio quick edits: which pages really changed between two renders.
# py -3 page_diff.py <dir> <prefixA> <prefixB> <pages>  ->  prints JSON list of changed page numbers.
# Ignores render noise (anti-aliasing differences of a few levels on a handful of pixels).
import json, os, sys
from PIL import Image, ImageChops

d, a, b, n = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
changed = []
for i in range(1, n + 1):
    fa, fb = os.path.join(d, f"{a}-{i}.png"), os.path.join(d, f"{b}-{i}.png")
    if not (os.path.exists(fa) and os.path.exists(fb)):
        changed.append(i); continue
    ia, ib = Image.open(fa).convert("RGB"), Image.open(fb).convert("RGB")
    if ia.size != ib.size:
        changed.append(i); continue
    diff = ImageChops.difference(ia, ib).convert("L").point(lambda v: 255 if v > 24 else 0)
    if diff.getbbox() and sum(diff.histogram()[255:]) > 20:
        changed.append(i)
print(json.dumps(changed))
