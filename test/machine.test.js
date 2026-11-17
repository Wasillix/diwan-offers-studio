// State machine unit tests (no agent, no disk beyond a temp store).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../server/machine.js';
import { makeTag, slugify } from '../server/store.js';
import { validateReview } from '../server/review.js';
import { editLine, promptFor } from '../server/prompts.js';
import { makeEnv, WEEK, statuses } from './helpers.js';

const review = (stage, round, extra = {}) => ({ stage, round, summary: 'ok', files: [], ...extra });

function freshJob(fields = {}) {
  const env = makeEnv();
  const job = env.store.create({ ...WEEK, ...fields }, { copyToolkit: false });
  env.cleanup();
  return job;
}

/** Run a stage through first round → review (no agent). */
function runToReview(job, key, extra) {
  const r = M.startRun(job, key);
  return M.finishRun(job, key, { review: review(key, r.n, extra), sessionId: `s-${key}`, cost: 0.1 });
}

test('tag and id helpers', () => {
  assert.equal(makeTag('Weekend Offers', '20 – 23 November 2026'), 'Weekend-20-23Nov');
  assert.equal(makeTag('Weekend Offers', '6 – 9 November 2026'), 'Weekend-6-9Nov');
  assert.equal(makeTag('Weekly Deals', '30 Nov – 3 December 2026'), 'Weekly-30-3Dec');
  assert.equal(makeTag('White Friday', '27 November 2026'), 'WhiteFriday-27Nov');
  assert.equal(slugify('Weekend-20-23Nov'), 'weekend-20-23nov');
});

test('confirm needs dates, skips stages whose deliverables are not ticked', () => {
  assert.throws(() => M.confirm(freshJob({ dates_ar: '' })), /dates/);
  const job = freshJob({ deliverables: ['carousel', 'caption', 'slides169', 'video'] });
  assert.equal(M.confirm(job), 'intake');
  assert.deepEqual(statuses(job), { intake: 'pending', images: 'pending', cards: 'pending', flyer: 'skipped', exports: 'skipped', social: 'pending', video: 'pending', delivery: 'pending' });
  assert.throws(() => M.confirm(job), /not a draft/);
});

test('approve → next stage; nothing runs while a stage awaits review', () => {
  const job = freshJob(); M.confirm(job);
  runToReview(job, 'intake');
  assert.equal(job.stages.intake.status, 'awaiting_review');
  assert.equal(M.nextStage(job), null);
  assert.equal(M.approve(job, 'intake'), 'images');
  assert.equal(M.currentStage(job), 'images');
  assert.throws(() => M.approve(job, 'images'), /pending, expected awaiting_review/);
});

test('edit round → same stage, round + 1, answers recorded', () => {
  const job = freshJob(); M.confirm(job);
  const r1 = M.startRun(job, 'intake');
  M.finishRun(job, 'intake', { review: review('intake', 1, { questions: [{ id: 'q1', text: 'Price?', blocking: true }] }), sessionId: 's1', cost: 0.2 });
  assert.equal(M.jobStatus(job), 'question');
  M.sendEdits(job, 'intake', [{ kind: 'answer', qid: 'intake:q1', text: '4.99$' }, 'drop the duplicate row']);
  assert.equal(job.stages.intake.status, 'editing');
  assert.equal(job.questions[0].answer, '4.99$');
  const r2 = M.startRun(job, 'intake');
  assert.equal(r2.n, r1.n + 1);
  assert.equal(r2.edits.length, 2);
  assert.equal(promptFor(job, 'intake', r2, 'X').resume, true);
  assert.throws(() => M.sendEdits(job, 'intake', []), /running/);
});

test('failed stage keeps the round; retry re-runs it', () => {
  const job = freshJob(); M.confirm(job);
  M.startRun(job, 'intake');
  M.failRun(job, 'intake', 'boom');
  assert.equal(M.jobStatus(job), 'failed');
  assert.equal(M.nextStage(job), null);
  const r = M.startRun(job, 'intake');
  assert.equal(r.n, 1); assert.equal(r.attempts, 2); assert.equal(r.error, undefined);
});

test('cards changed in a later edit round sends approved card stages back to pending', () => {
  const job = freshJob(); M.confirm(job);
  for (const k of ['intake', 'images', 'cards', 'flyer', 'exports']) { runToReview(job, k); M.approve(job, k); }
  runToReview(job, 'social');
  M.sendEdits(job, 'social', [{ kind: 'card', card: 'حلّوم روابي', text: 'price is 3.99$' }]);
  M.startRun(job, 'social');
  const hit = M.finishRun(job, 'social', { review: review('social', 2, { cards_changed: true }), sessionId: 's', cost: 0 });
  assert.deepEqual(hit, ['flyer', 'exports']);
  assert.equal(job.stages.flyer.status, 'pending');
  assert.ok(job.stages.flyer.rerun);
  M.approve(job, 'social');
  assert.equal(M.nextStage(job), 'flyer');
  const r = M.startRun(job, 'flyer');
  assert.equal(r.kind, 'rerun'); assert.equal(r.n, 2);
  assert.equal(promptFor(job, 'flyer', r, 'X').resume, false);
});

test('reopen an approved early stage rebuilds everything after it', () => {
  const job = freshJob(); M.confirm(job);
  for (const k of ['intake', 'images', 'cards', 'flyer']) { runToReview(job, k); M.approve(job, k); }
  assert.throws(() => M.reopen(job, 'images', []), /no edits/);
  const hit = M.reopen(job, 'cards', ['merge the Almarai laban flavours']);
  assert.deepEqual(hit, ['flyer']);
  assert.equal(job.stages.cards.status, 'editing');
  assert.equal(job.stages.cards.rounds.at(-1).kind, 'reopen');
});

test('interrupted runs recover as failed', () => {
  const job = freshJob(); M.confirm(job);
  M.startRun(job, 'intake');
  assert.ok(M.recoverInterrupted(job));
  assert.equal(job.stages.intake.status, 'failed');
});

test('review.json check', () => {
  assert.ok(validateReview(review('flyer', 2, { files: [{ path: 'review/flyer/r2/page-01.png', kind: 'image' }], checks: { overflow: 0 } }), { stage: 'flyer', round: 2 }).ok);
  const bad = validateReview({ stage: 'cards', round: 0, files: [{ path: '../x', kind: 'gif' }], checks: { a: [1] } }, { stage: 'flyer' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 5, bad.errors.join('\n'));
});

test('edit lines read like the spec', () => {
  assert.equal(editLine({ kind: 'pin', page: 4, x: 512, y: 830, text: 'change photo' }), '- [page 4, near 512,830] change photo');
  assert.equal(editLine({ kind: 'card', card: 'حلّوم روابي', text: '200 g pack' }), '- [card "حلّوم روابي"] 200 g pack');
  assert.equal(editLine({ kind: 'answer', qid: 'intake:q1', text: '4.99$' }), '- [answer q1] 4.99$');
  assert.equal(editLine({ kind: 'general', text: 'tone down', standing: true }), '- [general] tone down (this is a standing rule)');
});
