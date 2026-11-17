// Toolkit smoke test: copy toolkit/ into data/smoke/<look>, build + render + check, once per look.
// Default: flyer, carousel, 16:9 slides.  `--full` (npm run smoke:full) also does the final PNGs,
// flattened PDF, mobile HTML and the MP4.
// For the classic look it also checks the 6–9 Nov reference numbers so we notice if output changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, prepareBuild, runScript, listLooks } from '../server/toolkit.js';

const FULL = process.argv.includes('--full') || process.env.SMOKE_FULL === '1';
const REFERENCE = { classic: { pages: 22, cards: 108, skus: 135, carousel: 20, slides169: 32 } };

function must(r, what) {
  assert.ok(r.ok, `${what} failed (exit ${r.code})\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
const num = (out, key) => +(out.match(new RegExp(`${key} (\\d+)`)) || [])[1];
const count = (html, needle) => html.split(needle).length - 1;

for (const look of listLooks()) {
  test(`toolkit smoke: look "${look}"`, { timeout: 900_000 }, async (t) => {
    const dir = prepareBuild(path.join(ROOT, 'data', 'smoke', look), { look });
    const nCards = +must(runScript(dir, 'cards_count.py'), 'count cards').trim();

    await t.test('flyer builds, renders and passes check.js', () => {
      const out = must(runScript(dir, 'build_full.py'), 'build_full.py');
      const html = fs.readFileSync(path.join(dir, 'flyer.html'), 'utf8');
      const pages = count(html, '<section class="page');
      assert.ok(pages > 1, `flyer has ${pages} pages`);
      assert.equal(count(html, '<article class="card'), nCards, 'cards in flyer.html == len(CARDS)');
      assert.ok(html.includes(`class="look-${look}"`), 'body carries the look class');
      must(runScript(dir, 'render.js', [dir, '1', 'flyer']), 'render.js');
      assert.equal(fs.readdirSync(path.join(dir, 'out')).filter((f) => /^flyer-\d+\.png$/.test(f)).length, pages);
      const chk = runScript(dir, 'check.js', [dir]);
      const rep = JSON.parse(chk.stdout);
      assert.deepEqual(rep.overflow, [], 'no text overflow');
      assert.deepEqual(rep.outside, [], 'nothing outside the page');
      assert.deepEqual(rep.misaligned, [], 'same title-to-bottom on every page');
      assert.deepEqual(rep.lockedSizes, [], 'locked type sizes untouched by the look');
      if (rep.brokenImages.length) t.diagnostic(`${rep.brokenImages.length} images missing from img/ (expected until the full library is back)`);
      const ref = REFERENCE[look];
      if (ref) {
        assert.equal(pages, ref.pages, 'reference page count');
        assert.equal(nCards, ref.cards, 'reference card count');
        assert.equal(num(out, 'SKUs'), ref.skus, 'reference SKU count');
      }
    });

    await t.test('carousel: ≤20 slides per post, every card kept', () => {
      const out = must(runScript(dir, 'build_social.py'), 'build_social.py');
      const info = JSON.parse(fs.readFileSync(path.join(dir, 'social.json'), 'utf8'));
      for (const p of info.posts) assert.ok(p.count <= 20, `post with ${p.count} slides`);
      assert.equal(num(out, 'cards'), nCards);
      const chk = JSON.parse(runScript(dir, 'check_social.js', [dir]).stdout);
      assert.deepEqual(chk.overflow, [], 'no text overflow on slides');
      assert.deepEqual(chk.lockedSizes, [], 'locked sizes on slides');
      if (REFERENCE[look]) assert.equal(info.slides, REFERENCE[look].carousel);
    });

    await t.test('16:9 slides == slides169.json, render checks ok', () => {
      must(runScript(dir, 'build_169.py'), 'build_169.py');
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'slides169.json'), 'utf8'));
      const r = runScript(dir, 'render169.js', [dir]);
      assert.ok(r.ok, `render169 problems:\n${r.stdout}${r.stderr}`);
      assert.equal(fs.readdirSync(path.join(dir, 'out169')).filter((f) => f.endsWith('.png')).length, meta.length);
      assert.equal(meta[0].section, 'idx'); assert.equal(meta.at(-1).section, 'end');
      if (REFERENCE[look]) assert.equal(meta.length, REFERENCE[look].slides169);
    });

    if (FULL) {
      await t.test('final exports: 2x PNGs, flattened PDF, mobile HTML, MP4', () => {
        const tag = JSON.parse(fs.readFileSync(path.join(dir, 'offer.json'), 'utf8')).tag;
        must(runScript(dir, 'render_final.js', [dir]), 'render_final.js');
        const flat = must(runScript(dir, 'flatten_pdf.py'), 'flatten_pdf.py');
        assert.ok(num(flat, 'internal links') > 0 && num(flat, 'web links') > 0, `PDF links: ${flat}`);
        must(runScript(dir, 'mobile_build.py'), 'mobile_build.py');
        const mob = fs.readFileSync(path.join(dir, `Diwan-${tag}_Mobile.html`), 'utf8');
        assert.ok(mob.includes('color-scheme" content="only light'), 'mobile stays light');
        must(runScript(dir, 'make.py', [], { timeout: 600_000 }), 'make.py');
        assert.ok(fs.statSync(path.join(dir, `Diwan-${tag}_Slideshow.mp4`)).size > 100_000, 'MP4 written');
      });
    }
  });
}
