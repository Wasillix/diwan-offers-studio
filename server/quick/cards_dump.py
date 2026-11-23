# Studio quick edits: print the week's cards as JSON, merged with their prices from items2.json.
# Run with cwd = a job's build/ folder:  py -3 <this file> <build>
# Reads cards2.py (with the Studio quick-edit block applied) + items2.json + sections.json. Writes nothing.
import json, os, sys

B = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
sys.path.insert(0, B)
os.chdir(B)
from cards2 import CARDS  # noqa: E402

def load(name, default):
    f = os.path.join(B, name)
    return json.load(open(f, encoding="utf-8")) if os.path.exists(f) else default

SHEET = {r["code"]: r for r in load("items2.json", []) if isinstance(r, dict) and r.get("code")}
SECTIONS = {s["key"]: s for s in load("sections.json", []) if isinstance(s, dict) and s.get("key")}

out = []
for i, c in enumerate(CARDS, 1):
    codes = list(c.get("codes") or [])
    pkey = "p200" if c.get("per") else "price"
    rows = [SHEET.get(k) for k in codes]
    vals = {r.get(pkey) for r in rows if r}
    if c.get("from_") and None not in vals and len(vals) > 1:
        vals = {min(vals)}
    price = vals.pop() if len(vals) == 1 and len(rows) == len([r for r in rows if r]) else None
    savs = [r.get("saving") for r in rows if r]
    saving = None
    if savs and all(isinstance(v, (int, float)) and -1 < v < 0 for v in savs):
        saving = int(min(-v for v in savs) * 100 + 1e-9)
    lbp = bool(c.get("lbp")) or (bool(codes) and all(k.startswith("FRV") for k in codes))
    sec = SECTIONS.get(c.get("cat"), {})
    out.append({
        "n": i, "key": " ".join(codes), "codes": codes, "section": c.get("cat"),
        "section_ar": sec.get("title_ar"), "section_en": sec.get("title_en"),
        "ar": c.get("ar"), "en": c.get("en"), "u_ar": c.get("u_ar"), "u_en": c.get("u_en"),
        "var_ar": c.get("var_ar"), "short_ar": c.get("short_ar"), "save_txt": c.get("save_txt"),
        "price": price, "price_key": pkey, "mixed_prices": len({r.get(pkey) for r in rows if r}) > 1,
        "missing_codes": [k for k, r in zip(codes, rows) if not r],
        "saving": saving, "noprice": bool(c.get("noprice")), "lbp": lbp, "from": bool(c.get("from_")),
        "per": c.get("per"), "photos": ["build/img/" + p for p in (c.get("img") or [])],
    })

sys.stdout.write(json.dumps(out, ensure_ascii=False))
