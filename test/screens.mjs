// Screenshots of every Studio screen at 1440×900 → docs/screenshots/. Needs the mock server running with
// demo data (see README). Usage: node test/screens.mjs [baseUrl]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { launch } = require('../toolkit/paths.js');

const BASE = process.argv[2] || 'http://127.0.0.1:4321';
const OUT = path.resolve('docs/screenshots');
fs.mkdirSync(OUT, { recursive: true });
const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
const find = (fn) => jobs.find(fn)?.id;
const show = find((j) => j.current === 'flyer' && j.state !== 'draft');
const question = find((j) => j.state === 'question');
const late = find((j) => j.current === 'video');
const failed = find((j) => j.state === 'failed');

const b = await launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
// (no 'networkidle': the live-update stream keeps a request open forever)
const settle = async (ms = 1200) => { await p.waitForLoadState('load'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(ms); };
async function shot(name, hash, before) {
  await p.goto(`${BASE}/?s=${name}${hash}`); await settle(); // query forces a fresh load per shot
  if (before) { await before(); await settle(500); }
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('saved', name);
}

await shot('01-weeks', '#/');
await shot('02-new-week', '#/new', async () => {
  await p.fill('#f-from', '2026-11-27'); await p.fill('#f-to', '2026-11-30');
  await p.click('.look[data-look="market-bold"]');
});
if (show) {
  await shot('03-week-flyer-review', `#/week/${show}/flyer`);
  await shot('04-pin-a-comment', `#/week/${show}/flyer`, async () => {
    await p.click('.thumb[data-thumb="1"]'); await p.waitForTimeout(600);
    const img = await p.$('.lb-img img'); const box = await img.boundingBox();
    await p.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.33);
    await p.fill('.pin-pop textarea', 'Use the 1 kg burger box photo');
  });
  await shot('05-compare-rounds', `#/week/${show}/flyer`, async () => { await p.click('[data-compare]'); });
  await shot('06-card-table', `#/week/${show}/cards`, async () => {
    await p.click('[data-edit-card] >> nth=1'); await p.fill('.row-edit input', 'Price is 11.99$, not 12.99$');
  });
  await shot('07-live-log', `#/week/${show}/flyer`, async () => { await p.click('#log summary'); });
}
if (question) await shot('08-intake-questions', `#/week/${question}/intake`);
if (late) {
  await shot('09-exports-mobile', `#/week/${late}/exports`);
  await shot('10-social-caption', `#/week/${late}/social`, async () => { await p.evaluate(() => document.querySelector('.proof').scrollTo(0, 99999)); });
  await shot('11-video', `#/week/${late}/video`);
}
if (failed) await shot('12-failed-stage', `#/week/${failed}/images`);
await b.close();
