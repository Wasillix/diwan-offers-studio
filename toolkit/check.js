// Layout check: node check.js <buildDir> [file=flyer]
// Prints JSON: text overflow, per-page card count + title-to-bottom alignment, elements outside the page,
// broken images, and locked type sizes. Exit code 1 if anything fails (ok:false).
const { launch, buildDir, fileUrl, LOCKED } = require('./paths');
(async () => {
  const dir = buildDir(process.argv[2]), file = process.argv[3] || 'flyer';
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto(fileUrl(dir, file + '.html')); await p.evaluate(() => document.fonts.ready);
  const r = await p.evaluate((LOCKED) => {
    const out = { overflow: [], pages: [], outside: [], misaligned: [], brokenImages: [], lockedSizes: [] };
    document.querySelectorAll('.card h3, .card .en, .unit b, .var, .pill, .tile h3').forEach(el => {
      if (el.scrollWidth > el.clientWidth + 1) out.overflow.push(el.className + ': ' + el.textContent.trim());
    });
    document.querySelectorAll('section.page').forEach((s, i) => {
      const sr = s.getBoundingClientRect(); let bad = [];
      s.querySelectorAll('.card,.banner,.tile,.ibar,.foot,.grid').forEach(c => { const r = c.getBoundingClientRect(); if (r.bottom > sr.bottom + 1 || r.right > sr.right + 1) bad.push(c.className); });
      const cards = [...s.querySelectorAll('article.card')];
      const d = [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().bottom - c.querySelector('h3').getBoundingClientRect().top)))];
      out.pages.push(`${i + 1}: cards=${cards.length} titleToBottom=${d} bad=${bad}`);
      if (bad.length) out.outside.push(`${i + 1}: ${bad.join(' ')}`);
      if (d.length > 1) out.misaligned.push(`${i + 1}: ${d.join('/')}`);
    });
    const missing = new Set();
    document.querySelectorAll('img').forEach(im => { if (!im.complete || im.naturalWidth === 0) missing.add(im.getAttribute('src')); });
    out.brokenImages = [...missing];
    for (const [sel, px] of Object.entries(LOCKED)) {
      const sizes = new Set([...document.querySelectorAll(sel)].map(el => parseFloat(getComputedStyle(el).fontSize)));
      for (const sz of sizes) if (Math.abs(sz - px) > 0.05) out.lockedSizes.push(`${sel} is ${sz}px, locked at ${px}px`);
    }
    const nav = document.querySelector('.nav'); out.nav = nav ? nav.scrollWidth + '/' + nav.clientWidth : 'none';
    out.cards = document.querySelectorAll('article.card').length;
    return out;
  }, LOCKED);
  r.ok = !r.overflow.length && !r.outside.length && !r.misaligned.length && !r.lockedSizes.length;
  console.log(JSON.stringify(r, null, 1)); await b.close();
  process.exit(r.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
