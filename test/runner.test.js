// Runner + mock agent: the five scenarios from the build prompt, end to end on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../server/machine.js';
import { makeEnv, startWeek, act, statuses } from './helpers.js';

test('approve → next stage runs and reaches review', async (t) => {
  const env = makeEnv(); t.after(env.cleanup);
  let job = await startWeek(env);
  assert.equal(job.stages.intake.status, 'awaiting_review');
  const rv = env.store.readRoundReview(job.id, 'intake', 1);
  assert.equal(rv.stage, 'intake');
  assert.ok(job.questions.some((q) => q.id === 'intake:q2' && q.blocking));
  ({ job } = await act(env, job.id, (j) => M.approve(j, 'intake')));
  assert.equal(job.stages.intake.status, 'approved');
  assert.equal(job.stages.images.status, 'awaiting_review');
  assert.ok(job.cost > 0);
  const log = env.store.readLog(job.id);
  assert.ok(log.some((l) => l.type === 'system' && l.stage === 'images'));
});

test('edit round → same stage, round + 1, same agent session', async (t) => {
  const env = makeEnv(); t.after(env.cleanup);
  let job = await startWeek(env);
  const sid = job.stages.intake.sessionId;
  ({ job } = await act(env, job.id, (j) => M.sendEdits(j, 'intake', [{ kind: 'answer', qid: 'intake:q2', text: 'Use 2.49$' }, 'Merge the produce list'])));
  const s = job.stages.intake;
  assert.equal(s.status, 'awaiting_review');
  assert.equal(s.rounds.length, 2);
  assert.equal(s.rounds[1].sessionId, sid, 'edit rounds resume the stage session');
  const rv = env.store.readRoundReview(job.id, 'intake', 2);
  assert.equal(rv.round, 2);
  assert.deepEqual(rv.changes, ['Use 2.49$', 'Merge the produce list']);
  assert.ok(env.store.readRoundReview(job.id, 'intake', 1), 'round 1 review kept for history');
  assert.equal(job.questions.find((q) => q.id === 'intake:q2').answer, 'Use 2.49$');
});

test('skipped deliverables: carousel + video only goes intake → images → cards → social → video → delivery', async (t) => {
  const env = makeEnv(); t.after(env.cleanup);
  let job = await startWeek(env, { deliverables: ['carousel', 'caption', 'slides169', 'video'] });
  const order = [];
  while (job.status !== 'done') {
    const cur = M.currentStage(job);
    assert.equal(job.stages[cur].status, 'awaiting_review', `${cur} should be waiting`);
    order.push(cur);
    ({ job } = await act(env, job.id, (j) => M.approve(j, cur)));
  }
  assert.deepEqual(order, ['intake', 'images', 'cards', 'social', 'video', 'delivery']);
  assert.equal(job.stages.flyer.status, 'skipped');
  assert.equal(job.stages.exports.status, 'skipped');
  assert.equal(job.stages.flyer.rounds.length, 0);
  assert.equal(M.jobStatus(job), 'done');
});

test('failed stage: no valid review.json or an agent error → failed with log tail; retry recovers', async (t) => {
  const env = makeEnv({ failOn: { images: 1 }, invalidOn: { intake: 1 } }); t.after(env.cleanup);
  let job = await startWeek(env);
  assert.equal(job.stages.intake.status, 'failed');
  assert.match(job.stages.intake.error, /review\.json was not written/);
  ({ job } = await act(env, job.id, (j) => { j.stages.intake.retry = true; }));
  assert.equal(job.stages.intake.status, 'awaiting_review');
  assert.equal(job.stages.intake.rounds[0].attempts, 2);

  ({ job } = await act(env, job.id, (j) => M.approve(j, 'intake')));
  assert.equal(job.stages.images.status, 'failed');
  assert.match(job.stages.images.error, /Mock failure in images/);
  assert.ok(job.stages.images.lastLog.length > 0, 'last log lines kept for the UI');
  assert.equal(M.jobStatus(job), 'failed');
  ({ job } = await act(env, job.id, (j) => { j.stages.images.retry = true; }));
  assert.equal(job.stages.images.status, 'awaiting_review');
});

test('card edit after the flyer: approved later stages rebuild, flyer first', async (t) => {
  const env = makeEnv(); t.after(env.cleanup);
  let job = await startWeek(env);
  for (const k of ['intake', 'images', 'cards', 'flyer', 'exports']) ({ job } = await act(env, job.id, (j) => M.approve(j, k)));
  assert.equal(job.stages.social.status, 'awaiting_review');

  // a price fix on the carousel changes the cards → flyer + exports go back to pending
  ({ job } = await act(env, job.id, (j) => M.sendEdits(j, 'social', [{ kind: 'card', card: 'حلّوم روابي', text: 'price is 3.99$' }])));
  assert.equal(job.stages.social.status, 'awaiting_review');
  assert.equal(job.stages.flyer.status, 'pending');
  assert.equal(job.stages.exports.status, 'pending');
  assert.equal(env.store.readRoundReview(job.id, 'social', 2).cards_changed, true);

  ({ job } = await act(env, job.id, (j) => M.approve(j, 'social')));
  assert.equal(job.stages.flyer.status, 'awaiting_review');
  const fr = job.stages.flyer.rounds.at(-1);
  assert.equal(fr.kind, 'rerun'); assert.equal(fr.n, 2);
  assert.match(env.store.readRoundReview(job.id, 'flyer', 2).changes[0], /Rebuilt: cards changed in social round 2/);
  ({ job } = await act(env, job.id, (j) => M.approve(j, 'flyer')));
  assert.equal(job.stages.exports.status, 'awaiting_review');
  ({ job } = await act(env, job.id, (j) => M.approve(j, 'exports')));
  assert.equal(job.stages.video.status, 'awaiting_review', 'social stays approved; video is next');

  // reopening the cards after everything rebuilds every approved stage after it
  for (const k of ['video', 'delivery']) ({ job } = await act(env, job.id, (j) => M.approve(j, k)));
  assert.equal(job.status, 'done');
  ({ job } = await act(env, job.id, (j) => M.reopen(j, 'cards', [{ kind: 'card', card: 'كيري', text: 'remove this card' }])));
  assert.equal(job.stages.cards.status, 'awaiting_review');
  assert.equal(job.status, 'active');
  assert.deepEqual(['flyer', 'exports', 'social', 'video', 'delivery'].map((k) => job.stages[k].status), ['pending', 'pending', 'pending', 'pending', 'pending']);
});

test('cancel a running stage → failed "Cancelled"; queue runs one week at a time', async (t) => {
  const env = makeEnv({ delayMs: 40 }); t.after(env.cleanup);
  const a = env.store.create({ offer_name: 'Weekend Offers', dates_ar: 'x', dates_en: '20 – 23 November 2026' }, { copyToolkit: false });
  const b = env.store.create({ offer_name: 'Weekly Deals', dates_ar: 'x', dates_en: '24 – 26 November 2026' }, { copyToolkit: false });
  for (const j of [a, b]) { M.confirm(j); env.store.save(j); env.runner.kick(j.id); }
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(env.runner.queuePosition(a.id), 0);
  assert.equal(env.runner.queuePosition(b.id), 1);
  assert.equal(env.runner.cancel(a.id), 'aborted');
  await env.runner.idle();
  assert.equal(env.store.get(a.id).stages.intake.status, 'failed');
  assert.equal(env.store.get(a.id).stages.intake.error, 'Cancelled');
  assert.equal(env.store.get(b.id).stages.intake.status, 'awaiting_review');
  assert.ok(fs.existsSync(env.store.dir(b.id, 'review', 'intake', 'r1', 'inventory.html')));
});
