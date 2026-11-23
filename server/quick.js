// Quick edits: price, name, unit and saving changes that the Studio applies itself, without an agent run.
// The change goes into the week's build files (prices → items2.json, text → quick_edits.json, which a marked
// block at the end of cards2.py applies), then the toolkit rebuilds, renders and checks the flyer and the
// Studio writes review.json for a new round ("quick", $0). Anything else (layout, photos, rules) still goes
// to the agent through Send edits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScriptAsync } from './toolkit.js';
import { writeJsonAtomic } from './store.js';

export const QUICK_STAGES = ['flyer'];
const TEXT_FIELDS = { ar: 'Arabic name', en: 'English name', u_ar: 'Arabic unit', u_en: 'English unit', var_ar: 'variants' };
const HERE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'quick');
const DUMP = path.join(HERE, 'cards_dump.py');
const PAGE_DIFF = path.join(HERE, 'page_diff.py');
const BLOCK_START = '# >>> Studio quick edits';
const BLOCK = `
${BLOCK_START}: text changes Waseem made in the Studio without the agent (stored in quick_edits.json).
# Keep this block at the end of the file. To make a change permanent, write it into the card above and
# remove that card's entry from quick_edits.json.
def _studio_quick_edits():
    import json, os
    f = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quick_edits.json")
    if not os.path.exists(f):
        return
    edits = json.load(open(f, encoding="utf-8"))
    for c in CARDS:
        e = edits.get(" ".join(c["codes"]))
        if e:
            c.update({k: v for k, v in e.items() if k in ("ar", "en", "u_ar", "u_en", "var_ar", "save_txt")})
_studio_quick_edits()
# <<< Studio quick edits
`;

const err = (msg, code = 400) => Object.assign(new Error(msg), { code });
const tail = (s, n = 6) => String(s || '').trim().split(/\r?\n/).slice(-n).join('\n');

/** Add the quick-edit block to cards2.py if it isn't there (the agent may have rewritten the file). */
export function ensureBlock(buildDir) {
  const f = path.join(buildDir, 'cards2.py');
  const src = fs.readFileSync(f, 'utf8');
  if (src.includes(BLOCK_START)) return false;
  fs.writeFileSync(f, src.replace(/\s*$/, '\n') + BLOCK, 'utf8');
  return true;
}

/** The week's cards with their current prices (cards2.py + items2.json). */
export async function readCards(buildDir, { signal } = {}) {
  if (!fs.existsSync(path.join(buildDir, 'cards2.py'))) throw err('There is no card list in build/ yet (cards2.py).', 409);
  ensureBlock(buildDir);
  const r = await runScriptAsync(buildDir, DUMP, [buildDir], { timeout: 60_000, signal });
  if (!r.ok) throw err(`Reading the card list failed:\n${tail(r.stderr)}`, 500);
  return JSON.parse(r.stdout);
}

export function fmtPrice(v, lbp) {
  if (v == null) return 'no price';
  return lbp ? `${Math.round(v).toLocaleString('en-US').replace(/,/g, '.')}L.L` : `${(+v).toFixed(2)}$`;
}

function parsePrice(raw, lbp) {
  const s = String(raw).trim().replace(/\s|\$|l\.?l\.?/gi, '');
  // L.L. prices use the dot (or comma) for thousands: 550.000 = 550000. Dollar prices take a dot or comma as decimal.
  const n = lbp ? Number(s.replace(/[.,]/g, '')) : Number(s.replace(',', '.'));
  if (!s || !Number.isFinite(n) || n <= 0) throw err(`"${raw}" isn't a price`);
  return lbp ? Math.round(n) : Math.round(n * 100) / 100;
}

/**
 * Check the requested changes against the current cards. Returns [{ key, set: {...}, desc }] with only the
 * fields that actually change. Throws (400) on an unknown card or a bad value.
 */
export function planChanges(changes, cards) {
  if (!Array.isArray(changes) || !changes.length) throw err('no quick edits to apply');
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const out = [];
  for (const ch of changes) {
    const card = byKey.get(String(ch?.key ?? ''));
    if (!card) throw err(`card "${ch?.key}" isn't in the card list any more; reload the page`);
    const name = card.ar || card.en;
    const set = {}, parts = [];
    for (const [f, label] of Object.entries(TEXT_FIELDS)) {
      if (ch[f] === undefined) continue;
      const v = String(ch[f] ?? '').trim();
      if (!v && ['ar', 'en', 'u_ar', 'u_en'].includes(f)) throw err(`${name}: the ${label} can't be empty`);
      if (v === (card[f] || '')) continue;
      set[f] = v || null;
      parts.push(`${label} «${card[f] || ''}» → «${v}»`);
    }
    if (ch.price !== undefined && ch.price !== null && String(ch.price).trim() !== '') {
      if (card.noprice) throw err(`${name} is a no-price card (badge only); its price can't be set here`);
      const p = parsePrice(ch.price, card.lbp);
      if (p !== card.price) { set.price = p; parts.push(`price ${fmtPrice(card.price, card.lbp)} → ${fmtPrice(p, card.lbp)}`); }
    }
    if (ch.saving !== undefined) {
      const raw = String(ch.saving ?? '').trim();
      if (card.save_txt != null) {
        if (!raw) throw err(`${name}: the saving badge text can't be empty`);
        if (raw !== card.save_txt) { set.save_txt = raw; parts.push(`saving badge «${card.save_txt}» → «${raw}»`); }
      } else {
        const v = raw === '' ? null : Number(raw.replace('%', ''));
        if (v != null && (!Number.isInteger(v) || v < 10 || v > 90)) throw err(`${name}: saving must be a whole number from 10 to 90 (under 10% isn't shown), or empty for no badge`);
        if (v !== card.saving) { set.saving = v; parts.push(v == null ? 'saving badge removed' : `saving ${card.saving == null ? 'none' : `${card.saving}%`} → ${v}%`); }
      }
    }
    if (parts.length) out.push({ key: card.key, set, desc: `${name}: ${parts.join(', ')}` });
  }
  if (!out.length) throw err('nothing changed: the values are the same as on the flyer');
  return out;
}

/** Write the planned changes into build/items2.json and build/quick_edits.json (idempotent). */
export function applyChanges(buildDir, planned, cards) {
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const itemsFile = path.join(buildDir, 'items2.json');
  const items = fs.existsSync(itemsFile) ? JSON.parse(fs.readFileSync(itemsFile, 'utf8')) : [];
  const qeFile = path.join(buildDir, 'quick_edits.json');
  const qe = fs.existsSync(qeFile) ? JSON.parse(fs.readFileSync(qeFile, 'utf8')) : {};
  let itemsChanged = false, qeChanged = false;
  for (const { key, set } of planned) {
    const card = byKey.get(key);
    if (!card) throw err(`card "${key}" isn't in the card list any more`, 409);
    if ('price' in set || 'saving' in set) {
      if (card.missing_codes.length) throw err(`${card.ar || card.en}: ${card.missing_codes.join(', ')} not in items2.json`, 409);
      for (const row of items) {
        if (!row || !card.codes.includes(row.code)) continue;
        if ('price' in set) row[card.price_key] = set.price;
        if ('saving' in set) row.saving = set.saving == null ? null : -set.saving / 100;
        row.pnote = [row.pnote, 'Studio quick edit'].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('; ');
        itemsChanged = true;
      }
    }
    const text = Object.fromEntries(Object.entries(set).filter(([k]) => k in TEXT_FIELDS || k === 'save_txt'));
    if (Object.keys(text).length) { qe[key] = { ...(qe[key] || {}), ...text }; qeChanged = true; }
  }
  if (itemsChanged) writeJsonAtomic(itemsFile, items);
  if (qeChanged) writeJsonAtomic(qeFile, qe);
}

const count = (s, needle) => s.split(needle).length - 1;

/** The latest earlier round of this stage that has an archived review (for labels, carried files, diffs). */
function previousReview(jobDir, stage, beforeRound) {
  for (let n = beforeRound - 1; n >= 1; n--) {
    const f = path.join(jobDir, 'review', stage, `r${n}`, 'review.json');
    if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* skip */ } }
  }
  return null;
}

/**
 * Run one quick round: apply the changes, rebuild + render + check the flyer, write review.json.
 * Same shape as an agent run for the runner: resolves { cost: 0 } or throws.
 */
export async function runQuick({ job, stage, round, jobDir, onMessage, signal }) {
  if (!QUICK_STAGES.includes(stage)) throw new Error(`quick edits aren't available for ${stage}`);
  const build = path.join(jobDir, 'build');
  const say = (type, text) => onMessage?.({ type, text });
  const step = async (script, args, what, { allowFail = false } = {}) => {
    say('tool', `Studio · ${what}`);
    const r = await runScriptAsync(build, script, args, { signal });
    if (r.aborted) throw new Error('Cancelled');
    if (!r.ok && !allowFail) throw new Error(`${what} failed (exit ${r.code}):\n${tail(r.stderr || r.stdout)}`);
    return r;
  };
  const planned = round.quick || [];
  say('text', `Quick edit, no agent:\n${planned.map((p) => `- ${p.desc}`).join('\n')}`);

  const cards = await readCards(build, { signal });
  const outDir = path.join(build, 'out');
  const clear = (prefix) => { if (fs.existsSync(outDir)) for (const f of fs.readdirSync(outDir)) if (new RegExp(`^${prefix}-\\d+\\.png$|^${prefix}\\.pdf$`).test(f)) fs.rmSync(path.join(outDir, f)); };
  // Baseline: render the flyer as it is now, so "pages that changed" compares like with like
  // (the agent's own review PNGs can come from a different render).
  await step('build_full.py', [], 'build the current flyer (baseline)');
  fs.copyFileSync(path.join(build, 'flyer.html'), path.join(build, 'flyer_base.html'));
  clear('flyer_base');
  await step('render.js', [build, '1', 'flyer_base'], 'render the baseline');

  applyChanges(build, planned, cards);
  const built = await step('build_full.py', [], 'build flyer.html with the edits');
  const warns = built.stdout.split(/\r?\n/).filter((l) => l.startsWith('WARN')).map((l) => l.slice(5));
  clear('flyer');
  await step('render.js', [build, '1', 'flyer'], 'render pages');
  const chk = await step('check.js', [build], 'layout check', { allowFail: true });
  let rep;
  try { rep = JSON.parse(chk.stdout); } catch { throw new Error(`layout check failed:\n${tail(chk.stderr || chk.stdout)}`); }

  // review files
  const rel = (f) => `review/${stage}/r${round.n}/${f}`;
  const rdir = path.join(jobDir, 'review', stage, `r${round.n}`);
  fs.rmSync(rdir, { recursive: true, force: true });
  fs.mkdirSync(rdir, { recursive: true });
  const pngs = fs.readdirSync(outDir).filter((f) => /^flyer-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
  const prev = previousReview(jobDir, stage, round.n);
  const prevImages = (prev?.files || []).filter((f) => f.kind === 'image');
  const sameCount = prevImages.length === pngs.length;
  const files = [];
  const diff = await runScriptAsync(build, PAGE_DIFF, [outDir, 'flyer_base', 'flyer', String(pngs.length)], { timeout: 120_000, signal });
  let changedPages;
  try { changedPages = JSON.parse(diff.stdout); } catch { changedPages = null; } // Pillow missing: fall back to "all pages"
  if (!Array.isArray(changedPages)) changedPages = pngs.map((_, i) => i + 1);
  pngs.forEach((f, i) => {
    const name = `page-${String(i + 1).padStart(2, '0')}.png`;
    fs.copyFileSync(path.join(outDir, f), path.join(rdir, name));
    const label = sameCount && prevImages[i].label ? prevImages[i].label.split(':')[0].trim() : `${String(i + 1).padStart(2, '0')} · Page ${i + 1}`;
    files.push({ path: rel(name), kind: 'image', label });
  });
  if (fs.existsSync(path.join(outDir, 'flyer.pdf'))) {
    fs.copyFileSync(path.join(outDir, 'flyer.pdf'), path.join(rdir, 'flyer.pdf'));
    files.push({ path: rel('flyer.pdf'), kind: 'pdf', label: `Preview PDF (${pngs.length} pages)` });
  }
  const now = await readCards(build, { signal });
  const table = now.map((c) => ({
    n: c.n, section: c.section, section_ar: c.section_ar, ar: c.var_ar ? `${c.ar} (${c.var_ar})` : c.ar, en: c.en,
    unit: c.u_en, price: c.noprice ? null : c.price, currency: c.lbp ? 'L.L' : '$',
    saving: c.save_txt || (c.saving ? `${c.saving}%` : null), codes: c.codes, photos: c.photos,
  }));
  writeJsonAtomic(path.join(rdir, 'cards.json'), table);
  files.push({ path: rel('cards.json'), kind: 'table', label: `Card list: ${table.length} cards` });
  writeJsonAtomic(path.join(rdir, 'check.json'), rep);
  files.push({ path: rel('check.json'), kind: 'text', label: 'Layout check output' });
  // the agent's other notes for this stage (e.g. the client photo list) still apply: carry them over
  for (const f of prev?.files || []) {
    if (['image', 'pdf'].includes(f.kind) || /\/(cards|check)\.json$/.test(f.path)) continue;
    const src = path.join(jobDir, f.path);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
    const name = path.basename(f.path);
    if (files.some((x) => x.path === rel(name))) continue;
    fs.copyFileSync(src, path.join(rdir, name));
    files.push({ path: rel(name), kind: f.kind, label: f.label });
  }

  clear('flyer_base');
  fs.rmSync(path.join(build, 'flyer_base.html'), { force: true });
  const html = fs.readFileSync(path.join(build, 'flyer.html'), 'utf8');
  const placeholders = count(html, '"pi">X<') + count(html, 'price ph');
  const issues = rep.overflow.length + rep.outside.length + rep.misaligned.length + rep.brokenImages.length + rep.lockedSizes.length;
  const changes = planned.map((p) => p.desc);
  if (changedPages.length) changes.push(`Pages that changed: ${changedPages.join(', ')}.`);
  for (const o of rep.overflow) changes.push(`⚠ Text doesn't fit: ${o}`);
  for (const o of rep.outside) changes.push(`⚠ Outside the page: ${o}`);
  for (const o of rep.misaligned) changes.push(`⚠ Cards not aligned on page ${o}`);
  for (const w of warns) changes.push(`⚠ ${w}`);
  if (placeholders) changes.push(`⚠ ${placeholders} price placeholder${placeholders > 1 ? 's' : ''} on the flyer`);

  const review = {
    stage, round: round.n,
    summary: `Quick edit by the Studio, no agent run: ${planned.length} card${planned.length > 1 ? 's' : ''} changed and the flyer re-rendered`
      + (changedPages.length ? ` (page${changedPages.length > 1 ? 's' : ''} ${changedPages.join(', ')})` : '') + '. '
      + (issues || placeholders || warns.length ? 'The checks found something to look at: see the ⚠ lines.' : 'Layout check and price-placeholder check are clean.'),
    changes,
    assumptions: [],
    rules_added: [],
    files,
    checks: {
      pages: pngs.length,
      cards: table.length,
      overflow: rep.overflow.length,
      outside_page: rep.outside.length,
      alignment: rep.misaligned.length ? rep.misaligned.length : 'ok',
      broken_images: rep.brokenImages.length,
      locked_sizes: rep.lockedSizes.length ? rep.lockedSizes.length : 'ok',
      price_placeholders: placeholders,
      pages_changed: changedPages.join(', ') || 'none',
      agent_cost: '$0',
    },
    questions: [],
    cards_changed: true,
  };
  writeJsonAtomic(path.join(jobDir, 'review', stage, 'review.json'), review);
  say('text', review.summary);
  return { cost: 0 };
}

/** For the agent's next round: the quick rounds since its own last round, so it knows the build changed. */
export function quickNote(stageState, beforeRound) {
  const rounds = stageState.rounds.filter((r) => r.n < beforeRound);
  const lastAgent = rounds.filter((r) => r.kind !== 'quick').at(-1)?.n || 0;
  const quick = rounds.filter((r) => r.kind === 'quick' && r.n > lastAgent && r.finishedAt && !r.error);
  if (!quick.length) return '';
  return `\nSince your last round, Waseem made quick edits in the Studio (no agent), round${quick.length > 1 ? 's' : ''} ${quick.map((r) => r.n).join(', ')}:
${quick.flatMap((r) => (r.quick || []).map((q) => `- ${q.desc}`)).join('\n')}
Prices and savings were written into build/items2.json. Text changes are in build/quick_edits.json, applied by the
"Studio quick edits" block at the end of build/cards2.py. Keep them: if you rewrite cards2.py, keep that block at the end
(or fold the values into the cards and remove those entries from quick_edits.json).`;
}
