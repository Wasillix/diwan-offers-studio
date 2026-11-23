// Phase 5: dates from file names, settings, inbox watcher, weekly reminder, notifications, startup launcher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { guessFromFileName, upcomingWeekend, zonedParts } from '../server/dates.js';
import { Settings } from '../server/settings.js';
import { InboxWatcher } from '../server/inbox.js';
import { Scheduler } from '../server/scheduler.js';
import { Notifier, toastXml, TOAST_SCRIPT, watchTransitions } from '../server/notify.js';
import { Startup, launcherScript } from '../server/startup.js';
import * as M from '../server/machine.js';
import { makeEnv } from './helpers.js';

const NOW = new Date(2026, 10, 17, 9, 0); // Tue 17 Nov 2026, local

test('guess name and dates from a sheet file name', () => {
  assert.deepEqual(pick(guessFromFileName('Weekend Offers 20-23 Nov.xlsx', NOW)), { offer_name: 'Weekend Offers', dates_ar: '20 - 23 تشرين الثاني', dates_en: '20 – 23 November 2026' });
  assert.deepEqual(pick(guessFromFileName('Diwan Weekly Deals 30 Nov - 3 Dec.xlsx', NOW)), { offer_name: 'Weekly Deals', dates_ar: '30 تشرين الثاني - 3 كانون الأول', dates_en: '30 November – 3 December 2026' });
  assert.deepEqual(pick(guessFromFileName('La Farina Week2 23-26 Nov.xlsx', NOW)), { offer_name: 'La Farina Week2', dates_ar: '23 - 26 تشرين الثاني', dates_en: '23 – 26 November 2026' });
  assert.equal(guessFromFileName('New Year 2-4 Jan.xlsx', NOW).dates_en, '2 – 4 January 2027', 'January after November is next year');
  assert.equal(guessFromFileName('White Friday 27 November 2026.xlsx', NOW).dates_en, '27 November 2026');
  const none = guessFromFileName('offer sheet final v2.xlsx', NOW);
  assert.equal(none.dates_en, null);
  function pick(g) { return { offer_name: g.offer_name, dates_ar: g.dates_ar, dates_en: g.dates_en }; }
});

test('coming weekend and zoned time', () => {
  const w = upcomingWeekend(NOW);
  assert.equal(w.en, '20 – 23 November 2026');
  assert.equal(upcomingWeekend(new Date(2026, 10, 20)).en, '27 – 30 November 2026', 'on a Friday it means next week');
  const z = zonedParts(new Date(Date.UTC(2026, 10, 23, 8, 0)), 'Asia/Beirut'); // 10:00 in Beirut (UTC+2)
  assert.deepEqual([z.weekday, z.hour, z.ymd], [1, 10, '2026-11-23']);
});

function setup() {
  const env = makeEnv();
  const settings = new Settings(env.config);
  const sent = [];
  const notifier = { send: (n) => { sent.push(n); return Promise.resolve(n); } };
  return { ...env, settings, sent, notifier };
}

test('settings: defaults, partial updates, validation, saved to disk', (t) => {
  const e = setup(); t.after(e.cleanup);
  assert.equal(e.settings.get().schedule.time, '10:00');
  assert.equal(e.settings.get().schedule.timeZone, 'Asia/Beirut');
  e.settings.update({ schedule: { time: '09:30' }, newWeek: { tasks: 'one\n\n two ' } });
  assert.equal(e.settings.get().schedule.time, '09:30');
  assert.equal(e.settings.get().schedule.weekday, 1, 'untouched fields keep their value');
  assert.deepEqual(e.settings.get().newWeek.tasks, ['one', 'two']);
  assert.throws(() => e.settings.update({ schedule: { time: '25:00' } }), /HH:MM/);
  assert.throws(() => e.settings.update({ schedule: { timeZone: 'Mars/Olympus' } }), /time zone/);
  assert.equal(new Settings(e.config).get().schedule.time, '09:30', 'reloaded from data/settings.json');
  e.settings.update({ paths: { inbox: 'X:\\Inbox' } });
  assert.equal(e.config.inboxDir, 'X:\\Inbox', 'paths apply to the running config');
});

test('inbox: a new sheet becomes a draft with the guessed name and dates, once', async (t) => {
  const e = setup(); t.after(e.cleanup);
  const inboxDir = path.join(e.config.dataDir, 'inbox');
  e.settings.update({ paths: { inbox: inboxDir } });
  fs.mkdirSync(inboxDir, { recursive: true });
  fs.writeFileSync(path.join(inboxDir, 'Weekend Offers 20-23 Nov.xlsx'), 'fake sheet');
  fs.writeFileSync(path.join(inboxDir, '~$Weekend Offers 20-23 Nov.xlsx'), 'excel lock file');
  fs.writeFileSync(path.join(inboxDir, 'notes.txt'), 'not a sheet');
  const w = new InboxWatcher({ config: e.config, settings: e.settings, store: e.store, notifier: e.notifier, now: () => NOW, stableMs: 10, createOpts: { copyToolkit: false } });
  assert.equal((await w.scan()).length, 0, 'nothing is picked up before Setup is finished on this PC');
  e.settings.update({ setup: { done: true, at: NOW.toISOString() } });
  const made = await w.scan();
  assert.equal(made.length, 1);
  const job = e.store.get(made[0].id);
  assert.equal(job.status, 'draft', 'intake waits for Waseem to confirm');
  assert.equal(job.source, 'inbox');
  assert.equal(job.dates_en, '20 – 23 November 2026');
  assert.equal(job.inputs[0].role, 'sheet');
  assert.ok(fs.existsSync(e.store.dir(job.id, 'inputs', 'Weekend Offers 20-23 Nov.xlsx')));
  assert.ok(fs.existsSync(path.join(inboxDir, 'Weekend Offers 20-23 Nov.xlsx')), 'the inbox file is left where it was');
  assert.equal(e.sent[0].kind, 'inbox');
  assert.equal((await w.scan()).length, 0, 'same file is not picked up twice');
  fs.writeFileSync(path.join(inboxDir, 'Weekend Offers 20-23 Nov.xlsx'), 'fake sheet, corrected');
  assert.equal((await w.scan()).length, 1, 'a changed file is a new sheet');
});

test('reminder: fires once on the day at or after the time (Beirut), creates the draft for the coming weekend', (t) => {
  const e = setup(); t.after(e.cleanup);
  let now = new Date(Date.UTC(2026, 10, 23, 7, 59)); // Mon 09:59 Beirut
  const s = new Scheduler({ settings: e.settings, store: e.store, notifier: e.notifier, now: () => now, createOpts: { copyToolkit: false } });
  assert.match(s.nextRun(), /^Monday 23 November, 10:00 \(Asia\/Beirut\)$/);
  assert.equal(s.tick(), null, 'not yet');
  now = new Date(Date.UTC(2026, 10, 23, 9, 30)); // 11:30: the PC was off at 10:00
  assert.equal(s.tick(), null, 'a new install makes no draft before Setup is finished');
  e.settings.update({ setup: { done: true, at: now.toISOString() } });
  const job = s.tick();
  assert.ok(job);
  assert.equal(job.dates_en, '27 – 30 November 2026');
  assert.equal(job.source, 'reminder');
  assert.equal(e.sent.at(-1).kind, 'reminder');
  assert.equal(s.tick(), null, 'only once that day');
  assert.match(s.nextRun(), /^Monday 30 November/);
  e.settings.update({ schedule: { lastFired: null } });
  assert.equal(s.tick().id, job.id, 'a draft for those dates already exists: no duplicate');
  now = new Date(Date.UTC(2026, 10, 24, 9, 0)); // Tuesday
  e.settings.update({ schedule: { lastFired: null } });
  assert.equal(s.tick(), null, 'wrong day');
  e.settings.update({ schedule: { enabled: false } });
  assert.equal(s.nextRun(), null);
});

test('notifications: channels, per-event switches, toast script, state changes', async (t) => {
  const e = setup(); t.after(e.cleanup);
  const calls = [];
  const fakeSpawn = (cmd, args) => { calls.push([cmd, args]); const p = new EventEmitter(); p.stderr = new EventEmitter(); setImmediate(() => p.emit('close', 0)); return p; };
  const fakeFetch = async (url, opt) => { calls.push(['fetch', url, JSON.parse(opt.body)]); return { ok: true }; };
  process.env.TELEGRAM_BOT_TOKEN = 'T'; process.env.TELEGRAM_CHAT_ID = '42';
  t.after(() => { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; });
  const n = new Notifier({ config: e.config, settings: e.settings, spawnImpl: fakeSpawn, fetchImpl: fakeFetch });
  const browser = [];
  n.on('notify', (x) => browser.push(x));
  e.settings.update({ notifications: { telegram: true } });
  const r = await n.send({ kind: 'review', title: 'Flyer ready for review', body: 'Weekend Offers', url: '#/week/x/flyer' });
  assert.deepEqual(r.channels, process.platform === 'win32' ? ['browser', 'toast', 'telegram'] : ['browser', 'telegram']);
  assert.equal(browser[0].url, `http://localhost:${e.config.port}/#/week/x/flyer`);
  assert.equal(calls.find((c) => c[0] === 'fetch')[2].chat_id, '42');
  e.settings.update({ notifications: { on: { review: false } } });
  assert.ok((await n.send({ kind: 'review', title: 'x', body: 'y' })).skipped);
  const xml = toastXml({ title: 'حلّوم <روابي> & co', body: 'b', url: 'http://localhost:4321/#/week/a' });
  assert.doesNotMatch(TOAST_SCRIPT, /[^ -]/, 'the PowerShell script stays ASCII; text goes in TOAST_XML');
  assert.doesNotMatch(TOAST_SCRIPT, /EncodedCommand|WindowStyle/);
  assert.equal(calls[0][0], 'powershell.exe');
  assert.deepEqual(calls[0][1], ['-NoProfile', '-NonInteractive', '-Command', '-'], 'script through stdin: no -EncodedCommand, no hidden-window flag');
  assert.match(xml, /حلّوم &lt;روابي&gt; &amp; co/);
  assert.match(xml, /launch="http:\/\/localhost:4321\/#\/week\/a"/);

  // state changes → one notification each
  const got = [];
  const runner = new EventEmitter();
  const job = e.store.create({ offer_name: 'Weekend Offers', dates_ar: 'x', dates_en: '20 – 23 November 2026' }, { copyToolkit: false });
  M.confirm(job); e.store.save(job);
  watchTransitions({ runner, store: e.store, notifier: { send: (x) => got.push(x) } });
  M.startRun(job, 'intake'); runner.emit('job', job);
  M.finishRun(job, 'intake', { review: { stage: 'intake', round: 1, summary: 's', questions: [{ id: 'q1', text: '?', blocking: true }] } }); runner.emit('job', job);
  runner.emit('job', job); // no change, no second notification
  assert.deepEqual(got.map((g) => g.kind), ['question']);
  assert.equal(got[0].url, `#/week/${job.id}/intake`);
});

test('start with Windows: launcher created and removed in the Startup folder', (t) => {
  const e = setup(); t.after(e.cleanup);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const s = new Startup(e.config, dir);
  assert.equal(s.status().enabled, false);
  s.enable();
  const vbs = fs.readFileSync(s.file, 'utf8');
  assert.match(vbs, /WScript\.Shell/);
  assert.ok(vbs.includes(path.join(e.config.root, 'server', 'index.js')));
  assert.ok(vbs.includes('server.log'));
  assert.equal(s.status().enabled, true);
  s.disable();
  assert.equal(s.status().enabled, false);
  assert.match(launcherScript({ root: 'D:\\Diwan\\Offers Studio', node: 'C:\\Program Files\\nodejs\\node.exe', dataDir: 'D:\\x' }), /""""C:\\Program Files\\nodejs\\node\.exe""/);
});
