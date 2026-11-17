"""The week's settings, read from offer.json next to this file. Every build script imports from here.

offer.json keys: tag, offer_name_en, kicker_ar, kicker_en, dates_ar, dates_en, title_en, look,
image_library, logos_dir.  sections.json: [{key, nav, title_ar, title_en, img}, ...].
"""
import json, os

B = os.path.dirname(os.path.abspath(__file__))


def path(*p):
    return os.path.join(B, *p)


def read(p, mode="r"):
    with open(p, mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f:
        return f.read()


def write(p, text):
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def load_json(name):
    return json.loads(read(path(name)))


CFG = load_json("offer.json")
TAG = CFG["tag"]
OFFER_NAME_EN = CFG.get("offer_name_en", "Weekly Offers")
KICKER_AR = CFG["kicker_ar"]
KICKER_EN = CFG["kicker_en"]
DATES_AR = CFG["dates_ar"]
DATES_EN = CFG["dates_en"]
TITLE_EN = CFG.get("title_en") or f"{OFFER_NAME_EN} {DATES_EN}"
LOOK = CFG.get("look") or "classic"
IMAGE_LIBRARY = CFG.get("image_library", "")
LOGOS_DIR = CFG.get("logos_dir", "")

# (key, nav label / index tile title, Arabic page title, English title, index image)
SECTIONS = load_json("sections.json")
CATS = [(s["key"], s["nav"], s["title_ar"], s["title_en"], s["img"]) for s in SECTIONS]

BODY_CLASS = f"look-{LOOK}"


def base_css():
    """style.css + style_full.css, then themes/<LOOK>.css if it exists (the look layer)."""
    css = read(path("style.css")) + read(path("style_full.css"))
    return css + theme_css()


def theme_css():
    t = path("themes", f"{LOOK}.css")
    return ("\n/* theme: " + LOOK + " */\n" + read(t)) if os.path.exists(t) else ""


def theme_cover():
    """Optional per-look cover: themes/<LOOK>_cover.py with cover_html(bf). Returns the function or None."""
    p = path("themes", f"{LOOK}_cover.py")
    if not os.path.exists(p):
        return None
    import importlib.util
    spec = importlib.util.spec_from_file_location(f"cover_{LOOK.replace('-', '_')}", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, "cover_html", None)


def file_name(suffix):
    """Diwan-<TAG>_<suffix>, e.g. file_name('Mobile.html')."""
    return f"Diwan-{TAG}_{suffix}"
