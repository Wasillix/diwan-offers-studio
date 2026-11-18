// Phase 6: a full week on the real Offers Agent, end to end, playing Waseem's part automatically:
//   6–9 Nov sheet, look market-bold, all deliverables, tag DryRun-Weekend-6-9Nov (so the real 6–9 Nov
//   files in Claude outputs are never touched). Blocking questions get one "use your judgement" round;
//   the flyer gets one fake edit round (a pin + a general note); every other review is approved.
//   A failed stage is retried once. Progress goes to the console and data/dryrun-full.log.
// Usage: node test/dry-run-full.mjs            (resume an unfinished dry run: node test/dry-run-full.mjs <jobId>)
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { Settings } from '../server/settings.js';
import { JobStore } from '../server/store.js';
import { Runner } from '../server/runner.js';
import { createRealAgent } from '../server/agent/real.js';
import * as M from '../server/machine.js';

const settings = new Settings(config);
const store = new JobStore(config);
const runner = new Runner({ store, agent: createRealAgent(config, () => settings.get().agent) });
const logFile = path.join(config.dataDir, 'dryrun-full.log');
const say = (s) => { const line = `${new Date().toISOString().slice(11, 19)} ${s}`; console.log(line); fs.appendFileSync(logFile, line + '\n'); };
runner.on('log', (id, e) => { if (['app', 'error', 'result', 'system'].includes(e.type)) say(`  [${e.type}] ${String(e.text).split('\n')[0].slice(0, 220)}`); });

let job;
if (process.argv[2]) job = store.get(process.argv[2]);
else {
  const sheet = path.join(config.dataDir, 'fixtures', 'Weekend Offers 6-9 Nov.xlsx');
  if (!fs.existsSync(sheet)) throw new Error('Run py -3 test/fixtures/make_sheet.py first');
  job = store.create({
    offer_name: 'Weekend Offers', dates_ar: '6 - 9 تشرين الثاني', dates_en: '6 – 9 November 2026', tag: 'DryRun-Weekend-6-9Nov',
    look: 'market-bold', tasks: settings.get().newWeek.tasks, source: 'dry-run',
  });
  store.addInput(job.id, path.basename(sheet), fs.readFileSync(sheet));
  job.inputs.push({ name: path.basename(sheet), role: 'sheet', size: fs.statSync(sheet).size, addedAt: new Date().toISOString() });
  M.confirm(job);
  store.save(job);
}
say(`dry run ${job.id} · look ${job.look} · tag ${job.tag}`);

const t0 = Date.now();
const timing = {};
const retried = new Set();
const flyerEdited = { done: !!process.argv[2] && job.stages.flyer.rounds.length > 1 };
const answered = new Set();

function act(fn) { const j = store.get(job.id); fn(j); store.save(j); runner.kick(j.id); }

for (;;) {
  runner.kick(job.id);
  await runner.idle();
  job = store.get(job.id);
  if (job.status === 'done') break;
  const cur = M.currentStage(job);
  const s = job.stages[cur];
  if (s.status === 'failed') {
    if (retried.has(`${cur}:${s.rounds.at(-1).n}`)) { say(`✖ ${cur} failed twice: ${s.error}`); break; }
    retried.add(`${cur}:${s.rounds.at(-1).n}`);
    say(`↻ retry ${cur}: ${s.error}`);
    act((j) => { j.stages[cur].retry = true; });
    continue;
  }
  if (s.status !== 'awaiting_review') { say(`? ${cur} is ${s.status}; stopping`); break; }
  const r = s.rounds.at(-1);
  timing[cur] = (timing[cur] || 0) + (new Date(r.finishedAt) - new Date(r.startedAt));
  const rv = store.readRoundReview(job.id, cur, r.n);
  say(`■ ${cur} r${r.n} · $${(r.cost || 0).toFixed(2)} · ${rv?.summary?.slice(0, 160)}`);

  const open = job.questions.filter((q) => q.stage === cur && q.blocking && q.answer == null && !answered.has(q.id));
  if (open.length) {
    open.forEach((q) => answered.add(q.id));
    say(`  answering ${open.length} blocking question(s)`);
    act((j) => M.sendEdits(j, cur, open.map((q) => ({ kind: 'answer', qid: q.id, text: 'Dry run, no client answer available: use your best judgement and list it under assumptions.' }))));
    continue;
  }
  if (cur === 'flyer' && !flyerEdited.done) {
    flyerEdited.done = true;
    const pages = (rv.files || []).filter((f) => f.kind === 'image');
    const page = pages[Math.min(2, pages.length - 1)];
    say(`  sending the fake flyer edit round (pin on ${page?.path})`);
    act((j) => M.sendEdits(j, cur, [
      { kind: 'pin', file: page.path, page: pages.indexOf(page) + 1, x: 300, y: 600, text: 'Dry run edit: make the product photo on this card a little larger in its frame.' },
      { kind: 'general', text: 'Dry run edit: tone the yellow price bursts down slightly on the dairy pages; keep prices just as readable.' },
    ]));
    continue;
  }
  act((j) => M.approve(j, cur));
}

job = store.get(job.id);
say(`\n=== ${job.status === 'done' ? 'DONE' : 'STOPPED'} in ${Math.round((Date.now() - t0) / 60000)} min · total agent cost $${(job.cost || 0).toFixed(2)}`);
for (const [k, s] of Object.entries(job.stages)) {
  say(`${k.padEnd(9)} ${s.status.padEnd(16)} rounds ${s.rounds.length} · $${s.rounds.reduce((a, r) => a + (r.cost || 0), 0).toFixed(2)} · ${Math.round((timing[k] || 0) / 60000)} min`);
}
