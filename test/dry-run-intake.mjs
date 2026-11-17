// Phase 4 dry run: the intake stage of the 6–9 Nov week on the real Offers Agent, through the same
// store + runner the Studio uses. Prints the log as it goes, then review.json.
// Usage: node test/dry-run-intake.mjs
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { JobStore } from '../server/store.js';
import { Runner } from '../server/runner.js';
import { createRealAgent } from '../server/agent/real.js';
import * as M from '../server/machine.js';

const sheet = path.join(config.dataDir, 'fixtures', 'Weekend Offers 6-9 Nov.xlsx');
if (!fs.existsSync(sheet)) throw new Error('Run py -3 test/fixtures/make_sheet.py first');

const store = new JobStore(config);
const runner = new Runner({ store, agent: createRealAgent(config) });
runner.on('log', (id, e) => console.log(`${e.t.slice(11, 19)} [${e.type}] ${String(e.text).split('\n')[0].slice(0, 200)}`));

const job = store.create({
  offer_name: 'Weekend Offers', dates_ar: '6 - 9 تشرين الثاني', dates_en: '6 – 9 November 2026', look: 'classic',
  tasks: ['Dry run of the intake stage on the 6–9 Nov sheet (rebuilt from items2.json)'], source: 'dry-run',
});
store.addInput(job.id, path.basename(sheet), fs.readFileSync(sheet));
job.inputs.push({ name: path.basename(sheet), role: 'sheet', size: fs.statSync(sheet).size, addedAt: new Date().toISOString() });
M.confirm(job);
store.save(job);
console.log('job', job.id);
runner.kick(job.id);
await runner.idle();

const done = store.get(job.id);
const s = done.stages.intake;
console.log('\nstatus:', s.status, s.error || '', '| cost $' + (done.cost || 0).toFixed(3), '| agent', JSON.stringify(s.rounds.at(-1)?.agent || {}));
const rv = path.join(store.dir(job.id), 'review', 'intake', 'review.json');
console.log('\n--- review/intake/review.json ---');
console.log(fs.existsSync(rv) ? fs.readFileSync(rv, 'utf8') : '(not written)');
