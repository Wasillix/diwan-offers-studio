"""Rebuild img/logo-red.png and img/logo-white.png from the Diwan logos folder (LOGOS_DIR in offer.json).
Only needed when the logos change."""
import os
from PIL import Image
from offer import LOGOS_DIR, path

os.makedirs(path("img"), exist_ok=True)
for src, dst in [("Diwan.png", "logo-red.png"), ("Diwan2-01.png", "logo-white.png")]:
    im = Image.open(os.path.join(LOGOS_DIR, src)).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    im.thumbnail((700, 700))
    im.save(path("img", dst))
    print(dst, im.size)
