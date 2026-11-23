// Quick edits (server/quick.js): plan/validate changes, the runner's quick rounds, and one real
// build + render + check on a copy of the toolkit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as M from '../server/machine.js';
import { promptFor } from '../server/prompts.js';
import { planChanges, readCards, runQuick, ensureBlock } from '../server/quick.js';
import { validateReview } from '../server/review.js';
import { prepareBuild } from '../server/toolkit.js';
import { makeEnv, startWeek, act } from './helpers.js';

const CARD = (o = {}) => ({ key: 'A-1 A-2', codes: ['A-1', 'A-2'], ar: 'لبنة', en: 'Labneh', u_ar: '1 كغ', u_en: '1 Kg', var_ar: null,
  price: 4.5, price_key: 'price', saving: 20, save_txt: null, noprice: false, lbp: false, missing_codes: [], ...o });

test('planChanges: parses $ and L.L. prices, keeps only real changes, refuses bad values', () => {
  const cards = [CARD(), CARD({ key: 'C-1', codes: ['C-1'], ar: 'صدر دجاج', lbp: true, price: 550000 }),
    CARD({ key: 'P-1', codes: ['P-1'], ar: 'مرتديلا', noprice: true, price: null, save_txt: '15%' })];
  const p = planChanges([
    { key: 'A-1 A-2', price: '4,25', en: 'Labneh', saving: '25' },
    { key: 'C-1', price: '525.000' },
    { key: 'P-1', saving: 'حتى 20%' },
  ], cards);
  assert.deepEqual(p.map((x) => x.set), [{ price: 4.25, saving: 25 }, { price: 525000 }, { save_txt: 'حتى 20%' }]);
  assert.match(p[0].desc, /price 4\.50\$ → 4\.25\$, saving 20% → 25%/);
  assert.match(p[1].desc, /550\.000L\.L → 525\.000L\.L/);
  assert.equal(planChanges([{ key: 'A-1 A-2', saving: '' }], cards)[0].set.saving, null, 'empty saving removes the badge');
  assert.throws(() => planChanges([{ key: 'A-1 A-2', price: '4.50' }], cards), /nothing changed/);
  assert.throws(() => planChanges([{ key: 'P-1', price: '3' }], cards), /no-price card/);
  assert.throws(() => planChanges([{ key: 'A-1 A-2', saving: '5' }], cards), /10 to 90/);
  assert.throws(() => planChanges([{ key: 'A-1 A-2', price: 'abc' }], cards), /isn't a price/);
  assert.throws(() => planChanges([{ key: 'A-1 A-2', ar: '  ' }], cards), /can't be empty/);
  assert.throws(() => planChanges([{ key: 'nope', price: '1' }], cards), /isn't in the card list/);
});

async function toFlyerReview(env) {
  let job = await startWeek(env);
  for (const k of ['intake', 'images', 'cards']) ({ job } = await act(env, job.id, (j) => M.approve(j, k)));
  assert.equal(job.stages.flyer.status, 'awaiting_review');
  return job;
}

test('quick round: runs without the agent, $0, keeps the session and unsent edits; the next agent round is told', async (t) => {
  const env = makeEnv(); t.after(env.cleanup);
  let job = await toFlyerReview(env);
  const sid = job.stages.flyer.sessionId;
  const cost = job.cost;
  const agentRuns = [];
  const realRun = env.agent.run.bind(env.agent);
  env.agent.run = (a) => { agentRuns.push(a.round.n); return realRun(a); };
  env.runner.quick = async ({ stage, round, jobDir }) => {
    fs.writeFileSync(path.join(jobDir, 'review', stage, 'review.json'), JSON.stringify({ stage, round: round.n, summary: 'Quick edit', changes: round.quick.map((q) => q.desc), files: [], cards_changed: true }));
    return { cost: 0 };
  };
  job.stages.flyer.pendingEdits = [{ kind: 'general', text: 'Bigger cover title' }];
  env.store.save(job);
  const planned = [{ key: 'A-1', set: { price: 1.15 }, desc: 'بيبسي: price 1.25$ → 1.15$' }];
  ({ job } = await act(env, job.id, (j) => M.queueQuick(j, 'flyer', planned)));
  const s = job.stages.flyer;
  assert.equal(s.status, 'awaiting_review');
  assert.equal(s.rounds.at(-1).kind, 'quick');
  assert.equal(s.rounds.at(-1).cost, 0);
  assert.equal(job.cost, cost, 'no agent cost');
  assert.equal(s.sessionId, sid, 'agent session kept for the next edit round');
  assert.deepEqual(agentRuns, [], 'the agent did not run');
  assert.deepEqual(s.pendingEdits.map((e) => e.text), ['Bigger cover title'], 'unsent edits stay');

  assert.throws(() => M.queueQuick(env.store.get(job.id), 'cards', planned), /approved, expected awaiting_review/);

  M.sendEdits(job, 'flyer', s.pendingEdits);
  const { prompt, resume } = promptFor(job, 'flyer', job.stages.flyer.rounds.at(-1), env.store.dir(job.id));
  assert.equal(resume, true);
  assert.match(prompt, /quick edits in the Studio \(no agent\), round 2/);
  assert.match(prompt, /بيبسي: price 1\.25\$ → 1\.15\$/);
  assert.match(prompt, /quick_edits\.json/);
});

test('quick round failure → failed stage; retry runs the quick edit again', async (t) => {
  const env = makeEnv(); t.after(env.cleanup);
  let job = await toFlyerReview(env);
  let calls = 0;
  env.runner.quick = async ({ stage, round, jobDir }) => {
    if (++calls === 1) throw new Error('render.js failed');
    fs.writeFileSync(path.join(jobDir, 'review', stage, 'review.json'), JSON.stringify({ stage, round: round.n, summary: 'ok', files: [] }));
    return { cost: 0 };
  };
  ({ job } = await act(env, job.id, (j) => M.queueQuick(j, 'flyer', [{ key: 'A', set: { price: 2 }, desc: 'x' }])));
  assert.equal(job.stages.flyer.status, 'failed');
  assert.match(job.stages.flyer.error, /render\.js failed/);
  ({ job } = await act(env, job.id, (j) => { j.stages.flyer.retry = true; }));
  assert.equal(job.stages.flyer.status, 'awaiting_review');
  assert.equal(calls, 2);
});

test('quick edit on the real toolkit: prices + text land on the flyer, only those pages change', { timeout: 300_000 }, async (t) => {
  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diwan-quick-'));
  t.after(() => fs.rmSync(jobDir, { recursive: true, force: true }));
  const build = prepareBuild(path.join(jobDir, 'build'));
  fs.mkdirSync(path.join(jobDir, 'review', 'flyer'), { recursive: true });
  assert.equal(ensureBlock(build), true);
  assert.equal(ensureBlock(build), false, 'block added once');

  const cards = await readCards(build);
  assert.ok(cards.length > 50);
  const c = cards.find((x) => x.price != null && !x.lbp && !x.noprice && x.codes.length === 1);
  const newPrice = (c.price + 1).toFixed(2);
  const planned = planChanges([{ key: c.key, price: newPrice, en: `${c.en} TEST` }], cards);
  const logs = [];
  const r = await runQuick({ job: {}, stage: 'flyer', round: { n: 2, quick: planned }, jobDir, onMessage: (m) => logs.push(m) });
  assert.equal(r.cost, 0);

  const review = JSON.parse(fs.readFileSync(path.join(jobDir, 'review', 'flyer', 'review.json'), 'utf8'));
  const v = validateReview(review, { stage: 'flyer', round: 2, jobDir });
  assert.ok(v.ok, v.errors?.join('; '));
  assert.equal(review.cards_changed, true);
  assert.equal(review.checks.overflow, 0);
  assert.equal(typeof review.checks.price_placeholders, 'number');
  const changed = String(review.checks.pages_changed).split(', ').map(Number);
  assert.ok(changed.length >= 1 && changed.length < review.checks.pages, `only some pages change (${review.checks.pages_changed})`);

  const html = fs.readFileSync(path.join(build, 'flyer.html'), 'utf8');
  const [a, b] = newPrice.split('.');
  assert.ok(html.includes(`<span class="pi">${a}</span><span class="pd">.${b}</span>`), 'new price on the flyer');
  assert.ok(html.includes(`${c.en} TEST`), 'new English name on the flyer');
  const after = await readCards(build);
  assert.equal(after.find((x) => x.key === c.key).price, +newPrice);
  assert.ok(!fs.existsSync(path.join(build, 'flyer_base.html')), 'baseline files cleaned up');
  assert.ok(logs.some((l) => l.type === 'tool' && /render pages/.test(l.text)));
});
