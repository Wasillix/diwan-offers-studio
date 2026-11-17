// Final exports: node render_final.js <buildDir>
//   final/png/Diwan-<TAG>_NN.png (2160x2700) + final/Diwan-<TAG>_Interactive.pdf (Chrome PDF, flatten it next)
const { launch, buildDir, fileUrl, ensureDir, offer, path } = require('./paths');
(async () => {
  const dir = buildDir(process.argv[2]);
  const TAG = offer(dir).tag;
  const final = ensureDir(dir, 'final'), png = ensureDir(dir, 'final', 'png');
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await p.goto(fileUrl(dir, 'flyer.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const secs = await p.$$('section.page');
  for (let i = 0; i < secs.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    await secs[i].screenshot({ path: path.join(png, `Diwan-${TAG}_${n}.png`) });
  }
  // 1440x1800 css px * 0.75 = 1080 x 1350 pt, matching the Illustrator artboard
  await p.evaluate(() => document.querySelectorAll('img[src^="img/"]').forEach(i => { if (i.src.endsWith('.png')) i.src = i.getAttribute('src').replace('img/', 'img_pdf/'); }));
  await p.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))));
  await p.addStyleTag({ content: '@page{size:1440px 1800px;margin:0} html,body{background:none} body{zoom:1.3333333} .imgs img,.tshot img{filter:none!important}' });
  await p.waitForTimeout(300);
  await p.pdf({ path: path.join(final, `Diwan-${TAG}_Interactive.pdf`), preferCSSPageSize: true, printBackground: true });
  console.log(`final: ${secs.length} PNGs + PDF -> ${final}`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
