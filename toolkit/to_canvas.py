import re, json, html, sys, math
sys.path.insert(0, 'build')
M = json.load(open('canvas_assets_map.json'))
M.update({'logo-red.png': '6edf306d6d965dc1244c7bb6f0f341ed', 'logo-white.png': 'e3e2d13a0e35e4512651d7d5bb8ab5cb', 'qr.svg': 'fed6725b0329b341728fae2509a4b8b6'})
CSS = '/_blob/771fd1264513fb7a28d9c00b4c345add'
IG = '<a href="https://www.instagram.com/diwan.market" aria-label="Instagram"><svg viewBox="0 0 24 24" style="fill: none; stroke: #ffffff; stroke-width: 2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1" style="fill: #ffffff; stroke: none"></circle></svg></a>'
FB = '<a href="https://www.facebook.com/diwan.market" aria-label="Facebook"><svg viewBox="0 0 24 24" style="fill: none; stroke: #ffffff; stroke-width: 2; stroke-linejoin: round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>'
NAMES = {'meat': 'Meat', 'produce': 'Produce', 'dairy': 'Dairy', 'pantry': 'Pantry', 'bread': 'Bread', 'healthy': 'Healthy', 'snacks': 'Snacks', 'frozen': 'Frozen', 'home': 'Home'}
TITLES = {'meat': 'Meat & Poultry', 'produce': 'Fruits & Vegetables', 'dairy': 'Dairy & Cheese', 'pantry': 'Pantry', 'bread': 'Bread & Wraps', 'healthy': 'Healthy Snacks', 'snacks': 'Biscuits & Drinks', 'frozen': 'Frozen', 'home': 'Home & Cleaning'}
doc = open('build/flyer.html').read()
secs = re.findall(r'<section class="page (\w+)" id="([^"]+)">(.*?)</section>', doc, re.S)
# board name per section
counts = {}
for cls, sid, _ in secs:
    if sid != 'index': k = sid.split('-')[1]; counts[k] = counts.get(k, 0) + 1
def bname(sid):
    if sid == 'index': return 'Main.dc.html'
    p = sid.split('-'); k = p[1]; n = int(p[2]) if len(p) > 2 else 1
    return f'{NAMES[k]}.dc.html' if counts[k] == 1 else f'{NAMES[k]}-{n}.dc.html'
def btitle(i, sid):
    if sid == 'index': return '01 · Index'
    p = sid.split('-'); k = p[1]; n = int(p[2]) if len(p) > 2 else 1
    t = TITLES[k] + ('' if counts[k] == 1 else f' {n}/{counts[k]}')
    return f'{i+1:02d} · {t}'
def link(m):
    h = m.group(1)
    if h == '#index': return 'href="Main.dc.html"'
    return f'href="{bname(h[1:] if h.count("-") > 1 else h[1:])}"'
def img(m):
    fn = m.group(1)
    return f'src="/_blob/{M[fn]}"'
def social(m):
    return f'<span class="{m.group(1)}" dir="ltr">{IG}{FB}<b>@diwan.market</b></span>'
order, boards = [], {}
for i, (cls, sid, body) in enumerate(secs):
    b = re.sub(r'href="(#[^"]+)"', link, body)
    b = re.sub(r'src="img/([^"]+)"', img, b)
    b = re.sub(r'<span class="(social[^"]*)" dir="ltr">.*?<b>@diwan\.market</b></span>', social, b, flags=re.S)
    b = re.sub(r'<svg viewBox="0 0 24 24"><path', '<svg viewBox="0 0 24 24" aria-hidden="true"><path', b)
    b = re.sub(r'\n\s+', '\n', b).strip()
    name, title = bname(sid), btitle(i, sid)
    assert 'img/' not in b, name
    out = f'''<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8">
<title>{html.escape(title[5:])}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="{CSS}">
</head>
<body>
<x-dc>
<helmet>
<style>
body{{margin:0}}
a{{color:inherit}}a:hover{{color:inherit}}
</style>
</helmet>
<section class="page {cls}" style="width: 1080px; height: 1350px">
{b}
</section>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1080,"height":1350}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''
    open(f'canvas_root/project/{name}', 'w').write(out)
    order.append(name); boards[name] = {'x': (i % 6) * 1160, 'y': (i // 6) * 1470, 'w': 1080, 'h': 1350, 'title': title, 'is_interactive': True}
cj = json.load(open('canvas_root/project/canvas.json'))
old = set(cj['boards'])
cj['boards'] = boards; cj['order'] = order
json.dump(cj, open('canvas_root/project/canvas.json', 'w'), ensure_ascii=False)
print(order); print('removed', sorted(old - set(order)))
