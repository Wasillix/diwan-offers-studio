// 16:9 slides: node render169.js <buildDir> [scale=1.3333333333]  ->  out169/s-NN.png (1920x1080 at 4/3)
// Prints layout problems (overflow, outside the slide, grid hitting the footer) or "checks ok".
const { launch, buildDir, fileUrl, ensureDir, path } = require('./paths');
(async () => {
  const dir = buildDir(process.argv[2]), scale = +process.argv[3] || 4 / 3;
  const out169 = ensureDir(dir, 'out169');
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: scale });
  await p.goto(fileUrl(dir, 'slides169.html'));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.card h3, .card .en, .unit b, .var, .pill, .tile h3, .tile p, .idx h1').forEach(el => {
      if (el.scrollWidth > el.clientWidth + 1) out.push('overflow: ' + el.textContent.trim());
    });
    document.querySelectorAll('section.page').forEach((s, i) => {
      const sr = s.getBoundingClientRect();
      s.querySelectorAll('.card,.tile,.hbar,.foot,.grid,.ebar,.estores,.etxt').forEach(c => { const q = c.getBoundingClientRect(); if (q.bottom > sr.bottom + 1 || q.right > sr.right + 1 || q.left < sr.left - 1) out.push(`${i + 1} out: ${c.className}`); });
      const g = s.querySelector('.grid'), f = s.querySelector('.foot');
      if (g && f && g.getBoundingClientRect().bottom > f.getBoundingClientRect().top - 6) out.push(`${i + 1} grid hits footer ${g.getBoundingClientRect().bottom}/${f.getBoundingClientRect().top}`);
    });
    return out;
  });
  console.log(r.join('\n') || 'checks ok');
  const secs = await p.$$('section.page');
  for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: path.join(out169, `s-${String(i + 1).padStart(2, '0')}.png`) });
  console.log(`rendered ${secs.length} slides -> ${out169}`);
  await b.close();
  process.exit(r.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
