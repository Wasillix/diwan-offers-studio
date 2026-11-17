"""Instagram carousel: max 20 slides per post (cover + 19), max 6 cards per slide, every card kept.

Each section gets its own slides as in the flyer. If that comes to more than 20 slides, neighbouring
sections are put together on shared slides (smallest pair first, only when it saves a slide), and each
shared slide is titled by what is on it ("خبز وسناك صحّي"). If it still doesn't fit, the slides are
split into posts of up to 20, each starting with the cover. social.json records sections and posts.
"""
import math, os, sys, json
B = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, B)
import offer
import build_full as bf

e = bf.e
MAX_SLIDES = 20
SEC = {s["key"]: s for s in offer.SECTIONS}

# cards sit 3 per row here, so cards with a short name use it
for c in bf.CARDS:
    if c.get("short_ar"): c["ar"] = c["short_ar"]


def nav_multi(active):
    pills = ['<a class="pill home">الفهرس</a>']
    for k, lab, *_ in bf.CATS:
        pills.append(f'<a class="pill{" on" if k in active else ""}">{e(lab)}</a>')
    return '<nav class="nav" dir="rtl">' + "".join(pills) + '</nav>'


def page(cards, ar, en, active, n, total, last=False):
    return f'''
  <section class="page cat">
    {nav_multi(active)}
    <header class="head">
      <div class="title"><h2 dir="rtl">{e(ar)}</h2><p dir="ltr">{e(en)}</p></div>
      <div class="meta">
        <span class="date"><b dir="rtl">{bf.DATES_AR}</b><i dir="ltr">{bf.DATES_EN}</i></span>
        <span class="pg" dir="ltr">{n:02d}<em>/{total:02d}</em></span>
      </div>
    </header>
    {bf.layout(cards, last)}
    {bf.footer()}
  </section>'''


def cards_of(k): return [c for c in bf.CARDS if c["cat"] == k]


def n_slides(groups):
    return 1 + sum(math.ceil(sum(len(cards_of(k)) for k in g) / bf.PER_PAGE) for g in groups)


def plan_groups():
    """Merge neighbouring sections until the carousel fits in MAX_SLIDES (or no merge helps)."""
    groups = [[k] for k, *_ in bf.CATS]
    size = lambda g: sum(len(cards_of(k)) for k in g)
    pages = lambda n: math.ceil(n / bf.PER_PAGE)
    while n_slides(groups) > MAX_SLIDES:
        best = None
        for i in range(len(groups) - 1):
            a, b = size(groups[i]), size(groups[i + 1])
            if pages(a) + pages(b) - pages(a + b) > 0 and (best is None or a + b < best[0]):
                best = (a + b, i)
        if best is None: break
        i = best[1]
        groups[i:i + 2] = [groups[i] + groups[i + 1]]
    return groups


def shared_title(keys):
    if len(keys) == 1:
        s = SEC[keys[0]]; return s["title_ar"], s["title_en"]
    ar = [SEC[k].get("short_ar") or SEC[k]["nav"] for k in keys]
    en = [SEC[k].get("short_en") or SEC[k]["title_en"] for k in keys]
    return " و".join(ar), (", ".join(en[:-1]) + " & " + en[-1])


def build():
    cover = bf.cover().replace(
        '<span dir="rtl">تصفّح حسب القسم</span><hr><span dir="ltr">Tap a category</span>',
        '<span dir="rtl">اسحب وشوف كل العروض</span><hr><span dir="ltr">Swipe for all offers</span>')
    slides, meta = [], []   # meta: sections shown on each offer slide
    groups = plan_groups()
    for gi, g in enumerate(groups):
        last = gi == len(groups) - 1
        if len(g) == 1:
            ps = bf.cat_pages(g[0], last_cat=last)
            slides += ps; meta += [g] * len(ps)
            continue
        mix = [c for k in g for c in cards_of(k)]
        chunks = [mix[i:i + bf.PER_PAGE] for i in range(0, len(mix), bf.PER_PAGE)]
        for n, ch in enumerate(chunks, 1):
            ks = [k for k in g if any(c["cat"] == k for c in ch)]
            slides.append(page(ch, *shared_title(ks), ks, n, len(chunks), last and n == len(chunks)))
            meta.append(ks)
    # posts: cover + up to 19 offer slides each
    per_post = MAX_SLIDES - 1
    posts = [list(range(i, min(i + per_post, len(slides)))) for i in range(0, len(slides), per_post)] or [[]]
    pages = []
    for p in posts:
        pages.append(cover)
        pages += [slides[i] for i in p]
    return pages, posts, meta, groups


if __name__ == "__main__":
    pages, posts, meta, groups = build()
    n_cards = sum(p.count('<article class="card') for p in pages)
    assert n_cards == len(bf.CARDS), (n_cards, len(bf.CARDS))
    offer.write(offer.path("social.html"), bf.document(pages, f"Diwan Market – {offer.OFFER_NAME_EN} Carousel"))
    info = {"slides": len(pages), "posts": [], "groups": groups}
    i = 0
    for p in posts:
        info["posts"].append({"first": i + 1, "count": len(p) + 1})
        i += len(p) + 1
    offer.write(offer.path("social.json"), json.dumps(info, ensure_ascii=False, indent=1))
    print("slides", len(pages), "| posts", len(posts), "| cards", n_cards, "| SKUs", bf.N_SKU)
    if len(posts) > 1: print("WARN carousel split into", len(posts), "posts")
