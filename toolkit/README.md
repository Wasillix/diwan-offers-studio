# Toolkit (patched)

Patched copy of `D:\Diwan\Claude outputs\Pipeline\Toolkit-1-Scripts.zip` + `Toolkit-5-Images.zip`.
Each week is copied into the job's `build/` folder; only these files change per week:

| File | What |
|---|---|
| `offer.json` | tag, offer name, kicker AR/EN, dates AR/EN, look, image library + logos paths |
| `sections.json` | sections in order: key, nav label, page titles, index image, short names for shared carousel slides |
| `items2.json` | the offer sheet as JSON |
| `cards2.py` | the card list (`short_ar` = shorter name for carousel/16:9) |
| `image_map.json` | library photo → slug, for `prep_new.py` |
| `photo_notes.json` | optional, card name → photo issue, for the price sheet |
| `themes/<look>.css` | the look layer (classic is empty) |

Run Python with `PYTHONUTF8=1`. Node scripts take the build folder as first argument.

```
py -3 build_full.py              flyer.html
node render.js <build> 1 flyer   out/flyer-N.png
node check.js <build>            JSON report, exit 1 on overflow / misalignment / locked size change
py -3 build_social.py            social.html + social.json (≤20 slides per post)
node check_social.js <build>
py -3 build_169.py               slides169.html + slides169.json
node render169.js <build>        out169/s-NN.png
py -3 make.py                    Diwan-<TAG>_Slideshow.mp4
node render_final.js <build>     final/png + final/Diwan-<TAG>_Interactive.pdf
py -3 flatten_pdf.py             final/Diwan-<TAG>_Interactive_flat.pdf
py -3 mobile_build.py            Diwan-<TAG>_Mobile.html + mobile_artifact.html
py -3 prep_new.py                cut-outs from image_map.json → img/, img_pdf/, canvas_assets/
py -3 prep_imgs.py [out.png]     labelled contact sheet of the week's photos
py -3 logos.py                   img/logo-red.png + logo-white.png from logos_dir
```

`to_canvas.py` is left unpatched (canvas publishing is a claude.ai step).

## Images

`img/` here only holds the 26 `img_pdf` cut-outs (560 px) plus the two logos: the full 800 px `img/`
library from the cloud sessions was never zipped. Cut-outs from approved weeks get promoted into `img/`,
so it fills up week by week. `img/paper.jpg` (category page texture) is also missing; pages fall back to
the plain paper colour.
