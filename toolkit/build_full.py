import json, html, os, sys, math
B = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, B)
from cards2 import CARDS
from decimal import Decimal, ROUND_HALF_UP
import offer
from offer import DATES_AR, DATES_EN, KICKER_AR, KICKER_EN, TITLE_EN, BODY_CLASS
ICONS = offer.load_json("icons.json")
APP_URL = "https://me-qr.com/HWuSd2S0"  # old QR target, no longer used
APP_IOS = "https://apps.apple.com/lb/app/diwan-hypermarket/id1506406651"
APP_ANDROID = "https://play.google.com/store/apps/details?id=com.scopeexperts.diwan_hypermarketapp&hl=en"
IG_URL = "https://www.instagram.com/diwan.market"
FB_URL = "https://www.facebook.com/diwan.market"
HANDLE = "@diwan.market"
PER_PAGE = 6

# Sections come from sections.json (key, nav label / index tile title, Arabic page title, English title,
# index image). Sections with no cards are dropped so the agent never has to edit code.
SHEET = {r["code"]: r for r in offer.load_json("items2.json") if r.get("code") and r["code"] != "Diwan Item Number"}
SKU_COUNT = {}
for c in CARDS: SKU_COUNT[c["cat"]] = SKU_COUNT.get(c["cat"], 0) + len(c["codes"])
N_SKU = sum(SKU_COUNT.values())
WARN = []
CATS = [c for c in offer.CATS if SKU_COUNT.get(c[0])]
CAT = {c[0]: c for c in CATS}
for k in SKU_COUNT:
    if k not in CAT: WARN.append(f"cards in section '{k}' but it is not in sections.json: they are left out")

def e(s): return html.escape(s or "")

def r2(x): return Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_UP)

def fmt_price(card):
    rows = [SHEET[c] for c in card["codes"]]
    key = "p200" if card.get("per") else "price"
    vals = {r[key] for r in rows}
    if card.get("from_") and None not in vals and len(vals) > 1:
        vals = {min(vals)}  # "starting from" the lowest price on the card
    if None in vals or len(vals) != 1:
        if len(vals) > 1: WARN.append(f"{card['en']}: mixed prices {vals}")
        else: WARN.append(f"{card['en']}: no price in sheet")
        lbp = all(c.startswith("FRV") for c in card["codes"])
        return (f'<span class="price ph{" lbp" if lbp else ""}" dir="ltr"><span class="pi">X</span><span class="pd">{".XXX" if lbp else ".XX"}</span>'
                f'<span class="pc">{"L.L" if lbp else "$"}</span></span>'), None
    p = vals.pop()
    savs = [r["saving"] for r in rows]
    sav = None
    if all(isinstance(v, (int, float)) and -1 < v < 0 for v in savs):
        sav = int(min(-v for v in savs) * 100 + 1e-9)  # floor: never overstate the saving
        if sav < 10: sav = None  # savings under 10% are not shown
    if all(c.startswith("FRV") for c in card["codes"]):
        s_ = f"{int(round(p)):,}".replace(",", ".")
        a, b = s_.rsplit(".", 1) if "." in s_ else (s_, "")
        html_ = f'<span class="price lbp" dir="ltr"><span class="pi">{a}</span><span class="pd">{"." + b if b else ""}</span><span class="pc">L.L</span></span>'
    else:
        a, b = str(r2(p)).split(".")
        pf = '<span class="pf" dir="rtl">ابتداءً<br>من</span>' if card.get("from_") else ""
        html_ = f'<span class="price{" from" if pf else ""}" dir="ltr">{pf}<span class="pi">{a}</span><span class="pd">.{b}</span><span class="pc">$</span></span>'
    return html_, sav

def badge(it, sav):
    if it.get("save_txt"):  # client's fixed saving line, e.g. "حتى 20%" -> وفّر حتى / 20%
        words, pct = it["save_txt"].rsplit(" ", 1) if " " in it["save_txt"] else ("", it["save_txt"])
        return f'<span class="save up" dir="rtl"><b>{e(("وفّر " + words).strip())}</b>{e(pct)}</span>'
    return f'<span class="save" dir="rtl"><b>وفّر</b>{sav}%</span>' if sav else ""

def store_btns():
    return (f'<span class="stores" dir="ltr">'
            f'<a class="store" href="{e(APP_IOS)}"><svg viewBox="0 0 24 24"><path d="{ICONS["apple"]}"/></svg>'
            f'<span><small>Download on the</small><b>App Store</b></span></a>'
            f'<a class="store" href="{e(APP_ANDROID)}"><svg viewBox="0 0 24 24"><path d="{ICONS["play"]}"/></svg>'
            f'<span><small>GET IT ON</small><b>Google Play</b></span></a></span>')

def social(cls="social"):
    return (f'<span class="{cls}" dir="ltr">'
            f'<a href="{IG_URL}"><svg viewBox="0 0 24 24"><path d="{ICONS["instagram"]}"/></svg></a>'
            f'<a href="{FB_URL}"><svg viewBox="0 0 24 24"><path d="{ICONS["facebook"]}"/></svg></a>'
            f'<b>{HANDLE}</b></span>')

def card(it):
    imgs = it["img"] or []
    dup = it.get("dup", 1)
    if dup > 1 and len(imgs) == 1: imgs = imgs * dup
    if imgs:
        inner = "".join(f'<img src="img/{e(x)}" alt="">' for x in imgs)
        cls = " multi stack" if dup > 1 else (" multi" if len(imgs) > 1 else "")
        shot = f'<div class="shot{cls}"><div class="halo"></div><div class="imgs">{inner}</div>'
    else:
        shot = '<div class="shot noimg"><div class="halo"></div><div class="imgs"><span class="phimg">صورة المنتج<br><i>PRODUCT PHOTO</i></span></div>'
    if it.get("var_ar"): shot += f'<span class="var" dir="rtl">{e(it["var_ar"])}</span>'
    price, sav = fmt_price(it)
    shot += badge(it, sav)
    shot += '</div>'
    return f'''
    <article class="card">{shot}
      <h3 dir="rtl">{e(it["ar"])}</h3>
      <p class="en" dir="ltr">{e(it["en"])}</p>
      <div class="buy">{price}<span class="unit"><b dir="rtl">{e(it["u_ar"])}</b><i dir="ltr">{e(it["u_en"])}</i></span></div>
    </article>'''

PROMOS = [
    lambda: f'''<div class="card promo ink"><span class="pk">DIWAN PRIVÉ</span><b dir="rtl">ديوان بريفيه</b>
        <span class="pt" dir="rtl">انضم لبرنامج الولاء</span><span class="url" dir="rtl">اسأل عنه بأي فرع</span></div>''',
    lambda: f'''<div class="card promo alt"><span class="pk">CLOSE TO HOME</span><b dir="rtl">قريبين<br>منك!</b>
        <span class="pt" dir="rtl">5 فروع قريبة منك</span><span class="url" dir="rtl">الشويفات · طرابلس · النويري · الحمرا · الطريق الجديدة</span></div>''',
    lambda: f'''<div class="card promo"><span class="pk">FOLLOW US</span><b dir="rtl">تابعونا</b>
        <span class="pt" dir="rtl">عروض جديدة كل أسبوع</span>{social("social big")}</div>''',
]

BRANCHES = [("الشويفات", "الطريق العام قبل مفرق عرمون"), ("طرابلس", "البداوي قرب محطة قبيطري"),
            ("النويري", "سوق الذهب بعد نادي التعاضد"), ("الحمرا", "شارع مهاتما غاندي"),
            ("الطريق الجديدة", "طلعة المقاصد مقابل الموقف")]

def banner(rows, last=False):
    if last:
        return f'''
    <div class="banner rows{rows}" style="grid-row:span {rows}">
      <div class="bring a"></div><div class="bring b"></div>
      <div class="btxt" dir="rtl">
        <span class="pk" dir="ltr">DIWAN MARKET APP</span>
        <h4>حمّل تطبيق ديوان <br>واطلب من بيتك!</h4>
        <p dir="ltr">Download our app – order and get it delivered.</p>
        <ul><li>عروض جديدة كل أسبوع</li><li>توصيل لباب البيت</li></ul>
      </div>
      <div class="bstores">{store_btns()}</div>
    </div>'''
    br = "".join(f'<li><b>{e(a)}</b> {e(b)}</li>' for a, b in BRANCHES)
    return f'''
    <div class="banner brand rows{rows}" style="grid-row:span {rows}">
      <div class="bring a"></div><div class="bring b"></div>
      <div class="btxt" dir="rtl">
        <span class="pk" dir="ltr">SAVINGS THAT GO A LONG WAY</span>
        <h4>توفير بطووول! <br>عَ كل اللي بتحتاجو</h4>
        <p dir="ltr">Follow us for this week's offers</p>
        {social("social big")}
      </div>
      <ul class="bbranch" dir="rtl">{br}</ul>
    </div>'''

def fill(n, last=False):
    """HTML for the empty slots after n cards on a 9-slot page."""
    if n >= PER_PAGE: return ""
    out, partial = "", n % 3
    if partial:
        for k in range(3 - partial): out += PROMOS[k % 3]()
    rows_left = 3 - math.ceil(n / 3)
    if rows_left: out += banner(rows_left, last)
    return out

ROWS = {6: [3, 3], 5: [3, 2], 4: [2, 2], 3: [2, 1], 2: [2], 1: [1]}
GRID_H, GAP, INNER_W = 936, 18, 984

def layout(ch, last=False):
    """Arrange m cards on the page: same card size within a page, rows centred, page filled.
    The last page keeps one full-width row for the app banner."""
    m = len(ch)
    rows = ROWS[m]
    avail = GRID_H - (302 + GAP if last else 0)
    if last and m > 6: raise ValueError("last page too full for the app banner")
    row_h = (avail - GAP * (len(rows) - 1)) / len(rows)
    cols = max(rows)
    cw = (INNER_W - GAP * (cols - 1)) / cols
    html_, i = "", 0
    for r in rows:
        html_ += '<div class="grow">' + "".join(card(c) for c in ch[i:i + r]) + '</div>'
        i += r
    if last: html_ += banner(1, last=True)
    return f'<div class="grid flow" style="--rowh:{row_h:.1f}px;--cw:{cw:.1f}px">{html_}</div>'

def nav(active):
    pills = ['<a class="pill home" href="#index">الفهرس</a>']
    for k, lab, *_ in CATS:
        pills.append(f'<a class="pill{" on" if k == active else ""}" href="#cat-{k}">{e(lab)}</a>')
    return '<nav class="nav" dir="rtl">' + "".join(pills) + '</nav>'

def footer():
    return f'''
    <footer class="foot">
      <img class="logo" src="img/logo-red.png" alt="diwan market">
      <div class="tag"><b dir="rtl">توفير بطووول!</b><span dir="ltr">Savings that go a long way.</span></div>
      {social("social foot-s")}
    </footer>'''

def cat_pages(key, last_cat=False):
    k, lab, ar, en, _ = CAT[key]
    cs = [c for c in CARDS if c["cat"] == key]
    k_pages = math.ceil(len(cs) / PER_PAGE)
    base, extra = divmod(len(cs), k_pages)
    sizes = [base + (1 if i < extra else 0) for i in range(k_pages)]
    chunks, i0 = [], 0
    for sz in sizes: chunks.append(cs[i0:i0 + sz]); i0 += sz
    out = []
    for n, ch in enumerate(chunks, 1):
        anchor = f' id="cat-{key}"' if n == 1 else f' id="cat-{key}-{n}"'
        out.append(f'''
  <section class="page cat"{anchor}>
    {nav(key)}
    <header class="head">
      <div class="title"><h2 dir="rtl">{e(ar)}</h2><p dir="ltr">{e(en)}</p></div>
      <div class="meta">
        <span class="date"><b dir="rtl">{DATES_AR}</b><i dir="ltr">{DATES_EN}</i></span>
        <span class="pg" dir="ltr">{n:02d}<em>/{len(chunks):02d}</em></span>
      </div>
    </header>
    {layout(ch, last_cat and n == len(chunks))}
    {footer()}
  </section>''')
    return out

def ar_count(n): return f"{n} عروض" if 3 <= n <= 10 else f"{n} عرض"

def index_page():
    tiles = ""
    for k, lab, ar, en, img in CATS:
        tiles += f'''
      <a class="tile" href="#cat-{k}">
        <div class="tshot"><div class="halo"></div><img src="img/{img}" alt=""></div>
        <h3 dir="rtl">{e(lab)}</h3>
        <p dir="ltr">{e(en)}</p>
        <div class="trow"><span class="cnt" dir="rtl">{ar_count(SKU_COUNT.get(k, 0))}</span><span class="go">‹</span></div>
      </a>'''
    branches = [("الشويفات", "الطريق العام قبل مفرق عرمون"), ("طرابلس", "البداوي قرب محطة قبيطري"),
                ("النويري", "سوق الذهب بعد نادي التعاضد"), ("الحمرا", "شارع مهاتما غاندي"),
                ("الطريق الجديدة", "طلعة المقاصد مقابل الموقف")]
    br = "".join(f'<li><b>{e(a)}</b> {e(b)}</li>' for a, b in branches)
    return f'''
  <section class="page idx" id="index">
    <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
    <div class="itop">
      <img class="ilogo" src="img/logo-white.png" alt="diwan market">
      <span class="kicker" dir="rtl">{e(KICKER_AR)} <i dir="ltr">{e(KICKER_EN)}</i></span>
    </div>
    <div class="hero-t" dir="rtl">
      <h1>حديث<br>الأسبوع!</h1>
      <div class="sticker"><b>{DATES_AR}</b><i dir="ltr">{DATES_EN}</i></div>
    </div>
    <p class="sub" dir="ltr">THIS WEEK'S TALK · {N_SKU} offers across {len(CATS)} aisles</p>
    <div class="lbl"><span dir="rtl">تصفّح حسب القسم</span><hr><span dir="ltr">Tap a category</span></div>
    <div class="tiles" dir="rtl">{tiles}</div>
    <div class="ibar">
      <ul class="branches" dir="rtl">{br}</ul>
      <div class="iapp">
        <span class="iapp-t"><b dir="rtl">تابعونا</b><i dir="ltr">FOLLOW US</i>{social("social big")}</span>
      </div>
    </div>
  </section>'''

def cover():
    """Page 1: the look's own cover (themes/<look>_cover.py) if it has one, else the default index page."""
    fn = offer.theme_cover()
    return fn(sys.modules[__name__]) if fn else index_page()

def document(pages, title, extra_css=""):
    """Wrap pages in the HTML shell: base CSS + the look's theme CSS, body class look-<look>."""
    css = offer.base_css() + extra_css
    return (f'<!doctype html><html lang="ar"><head><meta charset="utf-8">\n'
            f'<title>{e(title)}</title><style>{css}</style></head>'
            f'<body class="{BODY_CLASS}">{"".join(pages)}</body></html>')

def build_pages():
    pages = [cover()]
    for k, *_ in CATS: pages += cat_pages(k, k == CATS[-1][0])
    return pages

def main():
    pages = build_pages()
    offer.write(offer.path("flyer.html"), document(pages, f"Diwan Market – {TITLE_EN}"))
    n_cards = sum(p.count('<article class="card') for p in pages)
    print("pages", len(pages), "| cards", n_cards, "| SKUs", N_SKU)
    for w in WARN: print("WARN", w)

if __name__ == "__main__":
    main()
