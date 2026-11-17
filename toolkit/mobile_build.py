"""Mobile web version of the week's flyer: one self-contained HTML page (fonts and images embedded).
Writes Diwan-<TAG>_Mobile.html and mobile_artifact.html. A look can add themes/<look>_mobile.css."""
import base64, io, os, sys, contextlib, html, re
from PIL import Image
B = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, B)
with contextlib.redirect_stdout(io.StringIO()):
    import build_full as bf
import offer
from cards2 import CARDS

def e(s): return html.escape(s or "")

_cache = {}
def img_uri(name, size=360, q=80):
    if (name, size) in _cache: return _cache[(name, size)]
    p = os.path.join(B, "img", name)
    if not os.path.exists(p):  # keep building; check_images / the images stage catches missing photos
        print("WARN missing image", name, file=sys.stderr)
        _cache[(name, size)] = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
        return _cache[(name, size)]
    im = Image.open(p).convert("RGBA"); im.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "WEBP", quality=q, method=4)
    uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    _cache[(name, size)] = uri; return uri

def font_uri(path, mime):
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(path); f.flavor = "woff2"; buf = io.BytesIO(); f.save(buf)
        return "data:font/woff2;base64," + base64.b64encode(buf.getvalue()).decode(), "woff2"
    except Exception:
        return f"data:{mime};base64," + base64.b64encode(offer.read(path, "rb")).decode(), "truetype" if mime.endswith("ttf") else "opentype"

FB, FBf = font_uri(f"{B}/fonts/Madani Arabic Bold.ttf", "font/ttf")
FX, FXf = font_uri(f"{B}/fonts/MADANI ARABIC EXTRA BOLD.TTF", "font/ttf")
FM, FMf = font_uri(f"{B}/fonts/MyriadPro-Regular.otf", "font/otf")
LOGO_W = img_uri("logo-white.png", 360, 90)
LOGO_R = img_uri("logo-red.png", 360, 90)
ICON = bf.ICONS

def svg(name): return f'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="{ICON[name]}"/></svg>'

def card(c):
    imgs = c["img"] or []
    dup = c.get("dup", 1)
    if dup > 1 and len(imgs) == 1: imgs = imgs * dup
    pics = "".join(f'<img src="{img_uri(x)}" alt="" loading="lazy" decoding="async">' for x in imgs[:3])
    price, sav = bf.fmt_price(c)
    price = price.replace('class="price', 'class="pr')
    badge = ('<span class="save up"><b>وفّر حتى</b>20%</span>' if c.get("save_txt")
             else (f'<span class="save"><b>وفّر</b>{sav}%</span>' if sav else ""))
    var = f'<span class="var">{e(c["var_ar"])}</span>' if c.get("var_ar") else ""
    search = e(f'{c["ar"]} {c["en"]} {c.get("var_ar") or ""}'.lower())
    return f'''<article class="card" data-s="{search}">
<div class="shot{' multi stack' if dup > 1 else (' multi' if len(imgs) > 1 else '')}"><span class="halo"></span><div class="pics">{pics}</div>{badge}{var}</div>
<h3>{e(c["ar"])}</h3><p class="en" dir="ltr">{e(c["en"])}</p>
<div class="buy">{price}<span class="unit"><b>{e(c["u_ar"])}</b><i dir="ltr">{e(c["u_en"])}</i></span></div>
</article>'''

chips, sections = [], []
for k, lab, ar, en, _ in bf.CATS:
    cs = [c for c in CARDS if c["cat"] == k]
    n = sum(len(c["codes"]) for c in cs)
    chips.append(f'<a class="chip" href="#cat-{k}" data-k="{k}">{e(lab)}</a>')
    sections.append(f'''<section class="cat" id="cat-{k}" data-k="{k}">
<header class="sh"><h2>{e(ar)}</h2><p><span dir="ltr">{e(en)}</span><span class="cnt">{bf.ar_count(n)}</span></p></header>
<div class="grid">{"".join(card(c) for c in cs)}</div></section>''')

branches = "".join(f'<li><b>{e(a)}</b><span>{e(b)}</span></li>' for a, b in bf.BRANCHES)

CSS = f'''
@font-face{{font-family:"Madani";src:url({FB}) format("{FBf}");font-weight:700;font-display:swap}}
@font-face{{font-family:"Madani";src:url({FX}) format("{FXf}");font-weight:800;font-display:swap}}
@font-face{{font-family:"Myriad";src:url({FM}) format("{FMf}");font-weight:400;font-display:swap}}
/* Layout: red brand band (sticky bar + hero) over a paper ground; offer grid 2-up on phones, 3-4 up wider. */
:root{{
  --red:#A12222; --signal:#DC2027; --yellow:#EDC11C; --ink:#111111; --paper:#F5F5F2;
  --bg:#F0ECE5; --card:#FFFFFF; --fg:#111111; --mute:#6D6762; --halo:#F0ECE5; --line:#E6E0D8;
  --chip:#FFFFFF; --chip-fg:#111111; --shadow:0 8px 22px rgba(60,20,20,.08); color-scheme:light;
  --ar:"Madani","Geeza Pro","Noto Kufi Arabic","Segoe UI",sans-serif;
  --lat:"Myriad","Myriad Pro","Helvetica Neue",Arial,sans-serif;
}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font-family:var(--ar);-webkit-font-smoothing:antialiased;font-size:16px}}
body::before{{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--red)}}
a{{color:inherit;text-decoration:none}} i{{font-style:normal}}
.wrap{{max-width:1100px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
:focus-visible{{outline:3px solid var(--yellow);outline-offset:2px;border-radius:8px}}

/* sticky bar */
.top{{position:sticky;top:env(safe-area-inset-top,0px);z-index:9;background:var(--red);color:#fff;box-shadow:0 6px 18px rgba(80,0,0,.18)}}
.bar{{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-block:10px 8px}}
.bar img{{height:34px;width:auto;display:block}}
.bar .d{{font-weight:800;font-size:15px;white-space:nowrap}}
.chips{{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-block:4px 12px;scroll-padding-inline:16px}}
.chips::-webkit-scrollbar{{display:none}}
.chip{{flex:0 0 auto;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:rgba(255,255,255,.25);position:relative;z-index:1;font-weight:700;font-size:15px;line-height:1;padding:10px 14px 8px;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.22)}}
.chip.on{{background:#fff;color:var(--red);border-color:#fff}}

/* hero */
.hero{{background:linear-gradient(170deg,var(--signal),var(--red) 70%);color:#fff;position:relative;overflow:hidden}}
.hero::after{{content:"";position:absolute;width:520px;height:520px;border-radius:50%;border:2px solid rgba(255,255,255,.12);left:-220px;top:-160px}}
.hero .wrap{{padding-block:22px 26px;display:grid;gap:14px;position:relative;z-index:1}}
.kick{{font-weight:700;font-size:15px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}}
.kick i{{font-family:var(--lat);letter-spacing:.14em;font-size:12px;opacity:.85;text-transform:uppercase}}
.hero h1{{margin:0;font-weight:800;font-size:clamp(52px,15vw,104px);line-height:.95;text-wrap:balance}}
.row{{display:flex;align-items:center;gap:14px;flex-wrap:wrap}}
.sticker{{background:var(--yellow);color:var(--ink);border-radius:18px;padding:10px 16px 8px;transform:rotate(-3deg);box-shadow:0 10px 22px rgba(0,0,0,.2)}}
.sticker b{{display:block;font-size:22px;font-weight:800;line-height:1.1}}
.sticker i{{display:block;font-family:var(--lat);font-size:13px}}
.meta{{font-family:var(--lat);font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.9}}
.find{{position:relative}}
.find input{{width:100%;font:700 16px var(--ar);padding:14px 46px 12px 16px;border-radius:16px;border:0;background:#fff;color:#111;box-shadow:0 10px 24px rgba(60,0,0,.22)}}
.find input::placeholder{{color:#8a837d}}
.find svg{{position:absolute;right:16px;top:50%;width:20px;height:20px;transform:translateY(-50%);fill:none;stroke:#A12222;stroke-width:2.4}}

/* sections */
main{{padding-block:8px 24px}}
.cat{{scroll-margin-top:calc(env(safe-area-inset-top,0px) + 116px);padding-top:22px}}
.sh{{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:12px;border-bottom:2px solid var(--line);padding-bottom:8px}}
.sh h2{{margin:0;color:var(--red);font-weight:800;font-size:clamp(26px,7vw,40px);line-height:1.1;text-wrap:balance}}
.sh p{{margin:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;text-align:left}}
.sh p span[dir]{{font-family:var(--lat);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}}
.cnt{{font-weight:700;font-size:13px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:5px 10px 3px}}
.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}
@media (min-width:640px){{.grid{{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}}}}
@media (min-width:960px){{.grid{{grid-template-columns:repeat(4,minmax(0,1fr))}}}}

/* card */
.card{{background:var(--card);border-radius:20px;box-shadow:var(--shadow);padding:10px 12px 12px;display:flex;flex-direction:column;min-width:0}}
.shot{{position:relative;aspect-ratio:1/1;max-width:100%;display:flex;align-items:center;justify-content:center}}
.halo{{position:absolute;width:84%;aspect-ratio:1;border-radius:50%;background:var(--halo)}}
.pics{{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:88%}}
.pics img{{max-width:86%;max-height:100%;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(0,0,0,.14))}}
.multi .pics img{{max-width:46%;margin-inline:-6%}}
.multi .pics img:nth-child(2){{z-index:1;transform:translateY(4%)}}
.save{{position:absolute;top:0;left:0;width:48px;height:48px;border-radius:50%;background:var(--ink);color:#fff;font-weight:800;font-size:15px;line-height:1;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2}}
.save b{{font-size:10px;font-weight:700;margin-bottom:2px}}
.save.up{{width:54px;height:54px;font-size:15px}} .save.up b{{font-size:9px;white-space:nowrap}}
.stack .pics img{{max-width:48%;margin-inline:-9%}}
.stack .pics img:nth-child(1){{transform:translateY(-3%)}} .stack .pics img:nth-child(3){{z-index:2;transform:translateY(8%)}}
.pf{{font-size:10px;line-height:1.05;font-weight:700;text-align:center;margin-right:6px;transform:none!important}}
.var{{position:absolute;bottom:0;left:0;max-width:100%;background:var(--ink);color:#fff;font-weight:700;font-size:11.5px;line-height:1.3;padding:5px 9px 3px;border-radius:10px;z-index:2}}
.card h3{{margin:8px 0 0;font-weight:700;font-size:17px;line-height:1.35;min-height:2.7em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}}
.en{{margin:2px 0 0;font-family:var(--lat);font-size:13.5px;line-height:1.3;color:var(--mute);text-align:right;min-height:2.6em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.buy{{margin-top:auto;padding-top:10px;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}}
.pr{{background:var(--red);color:#fff;border-radius:12px;height:40px;padding:0 10px;display:inline-flex;align-items:center;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;order:2}}
.pr>span{{display:inline-block;transform:translateY(2px)}}
.pi{{font-size:27px}} .pd,.pc{{font-size:15px;align-self:center;margin-top:-6px}} .pc{{margin-left:2px}}
.pr.lbp .pi{{font-size:22px}} .pr.lbp .pd{{font-size:14px}} .pr.lbp .pc{{font-size:12px}}
.pr.ph{{opacity:.9}}
.unit{{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;order:1}}
.unit b{{font-weight:800;font-size:14px}} .unit i{{font-family:var(--lat);font-size:11.5px;color:var(--mute)}}
.empty{{padding:40px 0;text-align:center;color:var(--mute);font-weight:700}}

/* app + branches */
.app{{margin-top:30px;background:linear-gradient(160deg,var(--signal),var(--red));color:#fff;border-radius:26px;padding:22px 20px;display:grid;gap:14px;position:relative;overflow:hidden}}
.app h2{{margin:0;font-weight:800;font-size:clamp(26px,7vw,36px);line-height:1.15}}
.app p{{margin:0;font-family:var(--lat);font-size:14px;opacity:.92}}
.app ul{{margin:0;padding:0;list-style:none;display:flex;gap:8px;flex-wrap:wrap}}
.app li{{font-weight:700;font-size:13px;background:rgba(255,255,255,.14);border-radius:999px;padding:6px 12px 4px}}
.stores{{display:flex;gap:10px;flex-wrap:wrap}}
.store{{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:#fff;border-radius:14px;padding:9px 14px}}
.store svg{{width:24px;height:24px;fill:#fff}}
.store span{{display:flex;flex-direction:column;font-family:var(--lat);line-height:1.05}}
.store small{{font-size:10px;opacity:.85}} .store b{{font-size:17px;font-weight:700}}
.qr{{display:none}}
@media (min-width:720px){{.app{{grid-template-columns:1fr auto;align-items:center}} .qr{{display:block;grid-row:1/span 4;grid-column:2;background:#fff;border-radius:16px;padding:10px;width:132px}} .qr img{{display:block;width:100%}}}}
.info{{margin-top:22px;display:grid;gap:18px}}
@media (min-width:720px){{.info{{grid-template-columns:1.4fr 1fr}}}}
.info h3{{margin:0 0 8px;font-weight:800;font-size:20px;color:var(--red)}}
.info ul{{margin:0;padding:0;list-style:none;display:grid;gap:8px}}
.info li{{display:flex;gap:8px;flex-wrap:wrap;font-size:15px;line-height:1.4}}
.info li b{{font-weight:800}} .info li span{{color:var(--mute);font-weight:700}}
.soc{{display:flex;gap:10px;align-items:center;flex-wrap:wrap}}
.soc a.i{{width:42px;height:42px;border-radius:50%;background:var(--red);display:inline-flex;align-items:center;justify-content:center}}
.soc svg{{width:20px;height:20px;fill:#fff}}
.soc b{{font-family:var(--lat);font-size:17px;font-weight:400}}
footer{{margin-top:26px;border-top:2px solid var(--line);padding-block:18px 28px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}}
footer img{{height:34px;width:auto}}
footer .t b{{display:block;color:var(--red);font-weight:800;font-size:20px}}
footer .t i{{font-family:var(--lat);font-size:13px;color:var(--mute)}}
footer .fine{{flex-basis:100%;font-size:12.5px;color:var(--mute);line-height:1.5}}
@media (prefers-reduced-motion: reduce){{*{{scroll-behavior:auto!important}}}}
html{{scroll-behavior:smooth;background:var(--bg)}}
'''

BODY = f'''
<div class="top" dir="rtl">
  <div class="wrap bar"><img src="{LOGO_W}" alt="diwan market"><span class="d">{bf.DATES_AR}</span></div>
  <nav class="wrap chips" aria-label="الأقسام">{"".join(chips)}</nav>
</div>
<div class="hero" dir="rtl"><div class="wrap">
  <span class="kick">{e(bf.KICKER_AR)} <i dir="ltr">{e(bf.KICKER_EN)}</i></span>
  <h1>حديث الأسبوع!</h1>
  <div class="row"><span class="sticker"><b>{bf.DATES_AR}</b><i dir="ltr">{bf.DATES_EN}</i></span>
  <span class="meta" dir="ltr">{bf.N_SKU} offers · {len(bf.CATS)} aisles</span></div>
  <label class="find" for="q"><span hidden>ابحث عن منتج</span>
    <input id="q" type="search" placeholder="ابحث عن منتج… Search" autocomplete="off" enterkeyhint="search">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></label>
</div></div>
<main class="wrap" dir="rtl">
{"".join(sections)}
<p class="empty" id="none" hidden>ما في نتائج. جرّب اسم تاني.<br><span dir="ltr">No matching offers.</span></p>
<section class="app" aria-label="Diwan app">
  <h2>حمّل تطبيق ديوان واطلب من بيتك!</h2>
  <p dir="ltr">Download our app – order and get it delivered.</p>
  <ul><li>عروض جديدة كل أسبوع</li><li>توصيل لباب البيت</li></ul>
  <div class="stores" dir="ltr">
    <a class="store" href="{e(bf.APP_IOS)}" target="_blank" rel="noopener">{svg("apple")}<span><small>Download on the</small><b>App Store</b></span></a>
    <a class="store" href="{e(bf.APP_ANDROID)}" target="_blank" rel="noopener">{svg("play")}<span><small>GET IT ON</small><b>Google Play</b></span></a>
  </div>
</section>
<div class="info">
  <div><h3>فروعنا</h3><ul>{branches}</ul></div>
  <div><h3>تابعونا</h3><div class="soc" dir="ltr">
    <a class="i" href="{bf.IG_URL}" target="_blank" rel="noopener" aria-label="Instagram">{svg("instagram")}</a>
    <a class="i" href="{bf.FB_URL}" target="_blank" rel="noopener" aria-label="Facebook">{svg("facebook")}</a>
    <b>{bf.HANDLE}</b></div></div>
</div>
<footer>
  <img src="{LOGO_R}" alt="diwan market">
  <span class="t"><b>توفير بطووول!</b><i dir="ltr">Savings that go a long way.</i></span>
  <p class="fine">العروض صالحة من {bf.DATES_AR} أو حتى نفاد الكمية. الأسعار بالدولار الأميركي ما عدا الخضار والفواكه بالليرة اللبنانية.<br><span dir="ltr">Offers valid {bf.DATES_EN} or while stocks last.</span></p>
</footer>
</main>
<script>
(() => {{
  const q = document.getElementById('q'), none = document.getElementById('none');
  const cards = [...document.querySelectorAll('.card')], secs = [...document.querySelectorAll('.cat')];
  const norm = s => s.toLowerCase().replace(/[\\u064B-\\u0652\\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  // Word-start matching: every typed word must be the beginning of a word in the
  // product's name or flavours ("oil" no longer finds "Toilet", "بيض" no longer finds "بيضا").
  const stripAl = w => w.replace(/^(وال|بال|لل|ال)(?=..)/, '');
  const words = s => norm(s).split(/[^0-9a-z\\u0621-\\u064a%]+/).filter(Boolean);
  cards.forEach(c => {{ const ws = words(c.dataset.s); c._w = [...new Set([...ws, ...ws.map(stripAl)])]; }});
  const hit = (c, ts) => ts.every(t => c._w.some(w => w.startsWith(t)));
  q.addEventListener('input', () => {{
    const ts = words(q.value).map(stripAl), on = ts.join('').length >= 2;
    cards.forEach(c => c.hidden = on && !hit(c, ts));
    let any = false;
    secs.forEach(s => {{ const v = s.querySelector('.card:not([hidden])'); s.hidden = !v; any = any || !!v; }});
    none.hidden = any;
  }});
  q.addEventListener('keydown', ev => {{ if (ev.key === 'Enter') q.blur(); }});
  const chips = [...document.querySelectorAll('.chip')], bar = document.querySelector('.chips');
  const mark = k => chips.forEach(c => {{
    const on = c.dataset.k === k; c.classList.toggle('on', on);
    if (on) bar.scrollTo({{ left: c.offsetLeft - bar.clientWidth / 2 + c.clientWidth / 2, behavior: 'smooth' }});
  }});
  let cur = null, lock = 0;
  const spy = () => {{
    if (Date.now() < lock) return;
    const y = document.querySelector('.top').getBoundingClientRect().bottom + 40;
    let k = null; secs.forEach(s => {{ if (!s.hidden && s.getBoundingClientRect().top <= y) k = s.dataset.k; }});
    if (k !== cur) {{ cur = k; mark(k); }}
  }};
  addEventListener('scroll', spy, {{ passive: true }}); spy();
  // Tap a category: scroll with script instead of relying on #hash jumps,
  // which iPhone browsers and in-app viewers often ignore inside a framed page.
  const go = k => {{
    const s = document.getElementById('cat-' + k); if (!s) return;
    if (s.hidden && q.value) {{ q.value = ''; q.dispatchEvent(new Event('input')); }}
    const top = s.getBoundingClientRect().top + scrollY - document.querySelector('.top').offsetHeight - 8;
    const before = scrollY;
    try {{ scrollTo({{ top, behavior: 'smooth' }}); }} catch (_) {{ scrollTo(0, top); }}
    setTimeout(() => {{ if (Math.abs(scrollY - before) < 2 && Math.abs(top - before) > 2) s.scrollIntoView({{ block: 'start' }}); }}, 350);
    lock = Date.now() + 1500; cur = k; mark(k);
  }};
  chips.forEach(c => c.addEventListener('click', ev => {{ ev.preventDefault(); go(c.dataset.k); }}));
}})();
</script>
'''

_mt = offer.path('themes', f'{offer.LOOK}_mobile.css')
if os.path.exists(_mt): CSS += offer.read(_mt)
HEAD = f'''<title>Diwan {e(offer.OFFER_NAME_EN)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="color-scheme" content="only light">
<meta name="theme-color" content="#A12222">
<meta name="description" content="Diwan Market {e(offer.OFFER_NAME_EN.lower())}, {bf.DATES_EN}">
<style>{CSS}</style>
'''
offer.write(offer.path("mobile_artifact.html"), HEAD + f'<div class="{bf.BODY_CLASS}">{BODY}</div>')
offer.write(offer.path(offer.file_name("Mobile.html")),
    f'<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
    f'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n{HEAD}</head>\n<body class="{bf.BODY_CLASS}">{BODY}</body>\n</html>\n')
print("size MB", round(os.path.getsize(f"{B}/mobile_artifact.html") / 1e6, 2), "| cards", len(CARDS))
