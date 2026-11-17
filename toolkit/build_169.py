"""16:9 slides for a video slideshow: index slide, category slides with up to 4 cards in one row,
and a closing app slide. Laid out at 1440x810 CSS px, rendered at 4/3 scale = 1920x1080."""
import os, sys, math, json
B = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, B)
import offer
import build_full as bf

e = bf.e
# cards sit 4 per row here, so cards with a short name use it
for c in bf.CARDS:
    if c.get("short_ar"): c["ar"] = c["short_ar"]
W, H = 1440, 810
PER = 4
bf.GAP = GAP = 18
INNER = W - 96
GRID_H = 470
CW = (INNER - GAP * (PER - 1)) / PER

def layout(ch):
    cards = "".join(bf.card(c) for c in ch)
    return (f'<div class="grid flow" style="--rowh:{GRID_H}px;--cw:{CW:.1f}px">'
            f'<div class="grow">{cards}</div></div>')

def cat_slides(key):
    k, lab, ar, en, _ = bf.CAT[key]
    cs = [c for c in bf.CARDS if c["cat"] == key]
    n = math.ceil(len(cs) / PER)
    base, extra = divmod(len(cs), n)
    sizes = [base + (1 if i < extra else 0) for i in range(n)]
    out, i0 = [], 0
    for j, sz in enumerate(sizes, 1):
        ch = cs[i0:i0 + sz]; i0 += sz
        out.append(f'''
  <section class="page cat">
    {bf.nav(key)}
    <header class="head">
      <div class="title"><h2 dir="rtl">{e(ar)}</h2><p dir="ltr">{e(en)}</p></div>
      <div class="meta">
        <span class="date"><b dir="rtl">{bf.DATES_AR}</b><i dir="ltr">{bf.DATES_EN}</i></span>
        <span class="pg" dir="ltr">{j:02d}<em>/{n:02d}</em></span>
      </div>
    </header>
    {layout(ch)}
    {bf.footer()}
  </section>''')
    return out

BRANCHES = [("الشويفات", "الطريق العام قبل مفرق عرمون"), ("طرابلس", "البداوي قرب محطة قبيطري"),
            ("النويري", "سوق الذهب بعد نادي التعاضد"), ("الحمرا", "شارع مهاتما غاندي"),
            ("الطريق الجديدة", "طلعة المقاصد مقابل الموقف")]

def index_slide():
    tiles = ""
    for k, lab, ar, en, img in bf.CATS:
        tiles += f'''
      <div class="tile">
        <div class="tshot"><div class="halo"></div><img src="img/{img}" alt=""></div>
        <h3 dir="rtl">{e(lab)}</h3>
        <p dir="ltr">{e(en)}</p>
        <div class="trow"><span class="cnt" dir="rtl">{bf.ar_count(bf.SKU_COUNT.get(k, 0))}</span></div>
      </div>'''
    br = "".join(f'<li><b>{e(a)}</b> {e(b)}</li>' for a, b in BRANCHES)
    return f'''
  <section class="page idx w">
    <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
    <div class="hcol" dir="rtl">
      <div class="itop">
        <img class="ilogo" src="img/logo-white.png" alt="diwan market">
        <span class="kicker" dir="rtl">{e(bf.KICKER_AR)} <i dir="ltr">{e(bf.KICKER_EN)}</i></span>
      </div>
      <h1>حديث<br>الأسبوع!</h1>
      <p class="sub" dir="ltr">THIS WEEK'S TALK · {bf.N_SKU} offers across {len(bf.CATS)} aisles</p>
      <div class="sticker"><b>{bf.DATES_AR}</b><i dir="ltr">{bf.DATES_EN}</i></div>
      <div class="hbar">
        <ul class="branches" dir="rtl">{br}</ul>
        <span class="iapp-t"><b dir="rtl">تابعونا</b><i dir="ltr">FOLLOW US</i>{bf.social("social big")}</span>
      </div>
    </div>
    <div class="tiles" dir="rtl">{tiles}</div>
  </section>'''

def end_slide():
    return f'''
  <section class="page idx w end">
    <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
    <img class="ilogo" src="img/logo-white.png" alt="diwan market">
    <div class="etxt" dir="rtl">
      <span class="pk" dir="ltr">DIWAN MARKET APP</span>
      <h1>حمّل تطبيق ديوان<br>واطلب من بيتك!</h1>
      <p dir="ltr">Download our app – order and get it delivered.</p>
      <ul><li>عروض جديدة كل أسبوع</li><li>توصيل لباب البيت</li></ul>
    </div>
    <div class="estores">{bf.store_btns()}</div>
    <div class="ebar">
      <div class="tag"><b dir="rtl">توفير بطووول!</b><span dir="ltr">Savings that go a long way.</span></div>
      <span class="sticker sm"><b>{bf.DATES_AR}</b><i dir="ltr">{bf.DATES_EN}</i></span>
      {bf.social("social big")}
    </div>
  </section>'''

CSS = f"""
@page{{size:{W}px {H}px;margin:0}}
.page{{width:{W}px;height:{H}px}}
/* category slides */
.cat{{padding:28px 48px 0}}
.head{{margin:20px 4px 16px}}
.grid.flow{{height:{GRID_H}px}}
.grid.flow .grow{{height:{GRID_H}px}}
.foot{{bottom:22px}}
/* index slide */
.idx.w{{display:grid;grid-template-columns:540px 1fr;gap:44px;padding:44px 48px;direction:rtl}}
.idx.w .hcol{{position:relative;display:flex;flex-direction:column;align-items:flex-start;direction:rtl}}
.idx.w .itop{{width:100%;flex-direction:row-reverse}}
.idx.w .ilogo{{height:74px}}
.idx.w .kicker{{font-size:19px;padding:8px 18px 6px}}
.idx.w .kicker i{{font-size:15px}}
.idx.w h1{{font-weight:800;font-size:104px;line-height:1.0;margin-top:22px;text-shadow:0 6px 30px rgba(0,0,0,.18);white-space:nowrap}}
.idx.w .sub{{text-align:right;margin-top:10px;font-size:16px}}
.idx.w .sticker{{margin:24px 6px 0 0;transform:rotate(-3deg);padding:14px 26px 11px}}
.idx.w .sticker b{{font-size:34px}}
.idx.w .sticker i{{font-size:17px}}
.idx.w .hbar{{margin-top:auto;width:100%;background:rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.14);border-radius:26px;padding:18px 24px 16px;display:flex;flex-direction:column-reverse;align-items:stretch;gap:12px}}
.idx.w .branches li{{white-space:nowrap}}
.idx.w .hbar .iapp-t{{flex-direction:row;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid rgba(255,255,255,.16);padding-bottom:12px}}
.idx.w .hbar .iapp-t i{{margin-left:auto}}
.idx.w .branches{{font-size:14.5px}}
.idx.w .iapp-t b{{font-size:22px}}
.idx.w .iapp-t i{{font-size:13px}}
.idx.w .tiles{{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:16px;align-self:stretch}}
.idx.w .tile{{height:auto;padding:12px 16px 14px;display:grid;grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto auto auto;flex:none}}
.idx.w .tile .tshot{{position:relative;left:auto;top:auto;transform:none;width:auto;height:auto;min-height:0}}
.idx.w .tile .tshot .halo{{width:104px;height:104px}}
.idx.w .tile .tshot img{{max-height:100px;max-width:70%}}
.idx.w .tile h3{{font-size:22px;margin-top:6px}}
.idx.w .tile p{{font-size:15px}}
.idx.w .tile .trow{{margin-top:8px;justify-content:flex-start}}
/* closing slide */
.end{{display:block;padding:56px 72px}}
.end .ilogo{{position:absolute;top:56px;left:72px;height:84px}}
.end .etxt{{position:absolute;right:72px;top:150px;text-align:right;display:flex;flex-direction:column;align-items:flex-start}}
.end .pk{{font-family:"Myriad";font-size:18px;letter-spacing:.2em;opacity:.8}}
.end h1{{font-size:96px;line-height:1.15;margin-top:12px;white-space:normal}}
.end .etxt p{{font-family:"Myriad";font-size:24px;opacity:.9;margin-top:14px}}
.end ul{{list-style:none;display:flex;gap:12px;margin-top:22px}}
.end li{{font-weight:700;font-size:20px;background:rgba(255,255,255,.14);border-radius:24px;padding:10px 18px 7px}}
.end .estores{{position:absolute;left:72px;top:270px}}
.end .estores .stores{{display:flex;flex-direction:column;gap:18px;margin:0}}
.end .estores .store{{padding:18px 30px;border-radius:18px;min-width:320px;border:2px solid rgba(255,255,255,.6)}}
.end .estores .store svg{{width:42px;height:42px}}
.end .estores .store small{{font-size:15px}}
.end .estores .store b{{font-size:30px}}
.end .estores .stores .store+.store{{border-left:2px solid rgba(255,255,255,.6);padding-left:30px}}
.end .ebar{{position:absolute;left:72px;right:72px;bottom:48px;border-top:2px solid rgba(255,255,255,.22);padding-top:24px;display:flex;justify-content:space-between;align-items:center}}
.end .tag{{display:flex;flex-direction:column;align-items:flex-end}}
.end .tag b{{font-size:34px;font-weight:800;color:#fff}}
.end .tag span{{font-family:"Myriad";font-size:16px;letter-spacing:.06em;opacity:.85;color:#fff}}
.end .sticker.sm{{margin:0;padding:12px 22px 9px}}
.end .sticker.sm b{{font-size:28px}}
.end .sticker.sm i{{font-size:15px}}
"""

slides, sec = [index_slide()], ["idx"]
for k, *_ in bf.CATS:
    s = cat_slides(k)
    slides += s; sec += [k] * len(s)
slides.append(end_slide()); sec.append("end")
n_cards = sum(s.count('<article class="card') for s in slides)
assert n_cards == len(bf.CARDS), (n_cards, len(bf.CARDS))
offer.write(offer.path("slides169.html"), bf.document(slides, f"Diwan Market – {offer.OFFER_NAME_EN} 16:9", CSS))
# make.py reads this to pick the transition between slides (same section / new section / app slide)
offer.write(offer.path("slides169.json"), json.dumps([{"n": i + 1, "section": k} for i, k in enumerate(sec)], indent=1))
print("slides", len(slides), "| cards", n_cards)
