"""Rebuild the interactive PDF as flattened page images + the original links.

Chrome's PDF keeps live text (Arabic CID fonts + Myriad as a Type 3 font), which some
viewers and print RIPs (Acrobat, Illustrator, printers) lay out with overlapping glyphs.
Here every page is the 2x PNG render, so it looks identical everywhere, and the category
jumps, store buttons and social links are copied from Chrome's PDF on top of the images.
"""
import glob, io, os, sys
from PIL import Image
from pypdf import PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import offer

SRC = offer.path("final", offer.file_name("Interactive.pdf"))
OUT = offer.path("final", offer.file_name("Interactive_flat.pdf"))
pngs = sorted(glob.glob(offer.path("final", "png", offer.file_name("[0-9]*.png"))))

r = PdfReader(SRC)
assert len(r.pages) == len(pngs), (len(r.pages), len(pngs))
page_ids = {p.indirect_reference.idnum: i for i, p in enumerate(r.pages)}
dest_page = {}
for name, d in r.named_destinations.items():
    dest_page[str(name)] = page_ids[d.page.idnum] if hasattr(d.page, "idnum") else page_ids[d["/Page"].idnum]

W, H = [float(x) for x in r.pages[0].mediabox[2:]]
c = canvas.Canvas(OUT, pagesize=(W, H))
c.setTitle(f"Diwan Market – {offer.OFFER_NAME_EN} {offer.DATES_EN}")
c.setAuthor("Diwan Market")
targets = set(dest_page.values())
n_int = n_uri = 0
for i, (page, png) in enumerate(zip(r.pages, pngs)):
    if i in targets:
        for name, pi in dest_page.items():
            if pi == i: c.bookmarkPage(name.lstrip("/"), fit="Fit")
    im = Image.open(png).convert("RGB")
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=86, optimize=True, subsampling=1); buf.seek(0)
    c.drawImage(ImageReader(buf), 0, 0, W, H)
    for a in page.get("/Annots") or []:
        a = a.get_object()
        if a.get("/Subtype") != "/Link": continue
        x1, y1, x2, y2 = [float(v) for v in a["/Rect"]]
        if "/Dest" in a:
            c.linkRect("", str(a["/Dest"]).lstrip("/"), (x1, y1, x2, y2), relative=0, thickness=0); n_int += 1
        elif "/A" in a and "/URI" in a["/A"]:
            c.linkURL(str(a["/A"]["/URI"]), (x1, y1, x2, y2), relative=0, thickness=0); n_uri += 1
    c.showPage()
c.save()
print("pages", len(pngs), "internal links", n_int, "web links", n_uri, "size MB", round(os.path.getsize(OUT) / 1e6, 1))
