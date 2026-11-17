// Preview render: node render.js <buildDir> [scale=1] [file=flyer]  ->  out/<file>-N.png + out/<file>.pdf
const { launch, buildDir, fileUrl, ensureDir, path } = require('./paths');
(async () => {
  const dir = buildDir(process.argv[2]), scale = +process.argv[3] || 1, file = process.argv[4] || 'flyer';
  const out = ensureDir(dir, 'out');
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: scale });
  await p.goto(fileUrl(dir, file + '.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const secs = await p.$$('section.page');
  for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: path.join(out, `${file}-${i + 1}.png`) });
  await p.pdf({ path: path.join(out, `${file}.pdf`), width: '1080px', height: '1350px', printBackground: true });
  console.log(`rendered ${secs.length} pages -> ${out}`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
