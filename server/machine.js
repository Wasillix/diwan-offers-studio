// Stage state machine (BUILD_SPEC §2). Pure functions that change a job object in place and throw
// MachineError on a move that isn't allowed. The runner and the API call these, then save the job.
//
//   pending → running → awaiting_review → (editing → running → awaiting_review)* → approved
//   running → failed → (retry) running          any → skipped (deliverable not ticked)
//   approved → (reopen with edits) editing      approved → pending (rerun: cards changed upstream)
import { STAGES, STAGE_KEYS, CARD_DEPENDENT, isNeeded, stageIndex } from './stages.js';

export class MachineError extends Error {
  constructor(msg, code = 409) { super(msg); this.code = code; }
}

const now = () => new Date().toISOString();
const st = (job, key) => {
  const s = job.stages[key];
  if (!s) throw new MachineError(`unknown stage "${key}"`, 404);
  return s;
};
const lastRound = (s) => s.rounds[s.rounds.length - 1];
function expect(job, key, ...allowed) {
  const s = st(job, key);
  if (!allowed.includes(s.status)) throw new MachineError(`stage "${key}" is ${s.status}, expected ${allowed.join(' or ')}`);
  return s;
}

/** Draft → active: skip stages whose deliverables aren't ticked. Returns the first stage to run. */
export function confirm(job) {
  if (job.status !== 'draft') throw new MachineError(`week is ${job.status}, not a draft`);
  if (!job.dates_ar || !job.dates_en) throw new MachineError('dates (Arabic and English) are required', 400);
  for (const { key } of STAGES) {
    const s = job.stages[key];
    s.status = isNeeded(key, job.deliverables) ? 'pending' : 'skipped';
  }
  job.status = 'active';
  job.confirmedAt = now();
  return nextStage(job);
}

/** The stage that should run next, or null if something is in progress / waiting / failed, or all done. */
export function nextStage(job) {
  if (job.status !== 'active') return null;
  // Any stage in progress, waiting for Waseem or failed (even one after a pending rerun) holds the queue.
  if (STAGE_KEYS.some((k) => ['running', 'awaiting_review', 'editing', 'failed'].includes(job.stages[k].status))) return null;
  return STAGE_KEYS.find((k) => job.stages[k].status === 'pending') || null;
}

/** The stage the week is "on" for the UI: the first one not approved or skipped. */
export function currentStage(job) {
  return STAGE_KEYS.find((k) => !['approved', 'skipped'].includes(job.stages[k].status)) || null;
}

/** Begin an agent run: a new round for a pending stage, the queued edit round, or a retry of a failed round. */
export function startRun(job, key) {
  const s = expect(job, key, 'pending', 'editing', 'failed');
  if (s.status === 'pending') {
    s.rounds.push({ n: s.rounds.length + 1, kind: s.rerun ? 'rerun' : 'first', edits: [], reason: s.rerunReason || null });
    s.rerun = false; s.rerunReason = null;
  } else if (s.status === 'failed') {
    const r = lastRound(s);
    r.attempts = (r.attempts || 1) + 1;
    delete r.error;
  }
  const r = lastRound(s);
  r.startedAt = now();
  delete r.finishedAt;
  s.status = 'running';
  s.error = null;
  return r;
}

/** Agent finished with a valid review.json. Returns the stages it sent back for a rerun. */
export function finishRun(job, key, { review, sessionId = null, cost = 0 }) {
  const s = expect(job, key, 'running');
  const r = lastRound(s);
  Object.assign(r, { finishedAt: now(), sessionId, cost: +(cost || 0), summary: review.summary, cardsChanged: !!review.cards_changed });
  if (sessionId) s.sessionId = sessionId;
  s.status = 'awaiting_review';
  job.cost = +((job.cost || 0) + (+cost || 0)).toFixed(4);
  mergeQuestions(job, key, review.questions || []);
  // Cards or prices changed in an edit round: the flyer is the master, so approved card-dependent stages rebuild.
  if (review.cards_changed && stageIndex(key) >= stageIndex('cards')) {
    return invalidate(job, CARD_DEPENDENT.filter((k) => k !== key), `cards changed in ${key} round ${r.n}`);
  }
  return [];
}

export function failRun(job, key, error) {
  const s = expect(job, key, 'running');
  const r = lastRound(s);
  r.finishedAt = now();
  r.error = String(error || 'failed');
  s.status = 'failed';
  s.error = r.error;
}

/** Waseem sends edits on the review: queue round n+1 in the same agent session. */
export function sendEdits(job, key, edits) {
  const s = expect(job, key, 'awaiting_review');
  queueEditRound(job, s, edits);
}

/**
 * Quick edits (server/quick.js): the Studio applies price/name/unit/saving changes itself and re-renders,
 * no agent. `planned` = [{ key, set, desc }]. Queues a "quick" round; the stage's unsent edits stay.
 */
export function queueQuick(job, key, planned) {
  const s = expect(job, key, 'awaiting_review');
  if (!Array.isArray(planned) || !planned.length) throw new MachineError('no quick edits to apply', 400);
  s.rounds.push({ n: s.rounds.length + 1, kind: 'quick', edits: [], quick: planned, queuedAt: now() });
  s.status = 'editing';
  return lastRound(s);
}

/** Change something in a stage that's already approved. Later approved stages that depend on it rebuild. */
export function reopen(job, key, edits) {
  const s = expect(job, key, 'approved');
  if (job.status === 'done') job.status = 'active';
  for (const k of STAGE_KEYS) if (stageIndex(k) > stageIndex(key) && ['awaiting_review', 'failed'].includes(job.stages[k].status)) {
    throw new MachineError(`finish or approve "${k}" before reopening "${key}"`);
  }
  queueEditRound(job, s, edits, 'reopen');
  const later = STAGE_KEYS.filter((k) => stageIndex(k) > stageIndex(key));
  const deps = stageIndex(key) <= stageIndex('cards') ? later : later.filter((k) => k === 'delivery');
  return invalidate(job, deps, `${key} reopened`);
}

function queueEditRound(job, s, edits, kind = 'edits') {
  const list = normaliseEdits(edits);
  if (!list.length) throw new MachineError('no edits to send', 400);
  s.rounds.push({ n: s.rounds.length + 1, kind, edits: list, queuedAt: now() });
  s.pendingEdits = [];
  s.status = 'editing';
  for (const e of list) if (e.kind === 'answer' && e.qid) {
    const q = job.questions.find((x) => x.id === e.qid);
    if (q) { q.answer = e.text; q.answeredAt = now(); }
  }
}

export function approve(job, key) {
  const s = expect(job, key, 'awaiting_review');
  lastRound(s).approvedAt = now();
  s.status = 'approved';
  if (STAGE_KEYS.every((k) => ['approved', 'skipped'].includes(job.stages[k].status))) {
    job.status = 'done';
    job.doneAt = now();
  }
  return nextStage(job);
}

/** Approved, not-skipped stages in `keys` go back to pending and rebuild in order. */
export function invalidate(job, keys, reason) {
  const hit = [];
  for (const k of keys) {
    const s = job.stages[k];
    if (s && s.status === 'approved') { s.status = 'pending'; s.rerun = true; s.rerunReason = reason; hit.push(k); }
  }
  if (hit.length && job.status === 'done') job.status = 'active';
  return hit;
}

/** On server start: a run that was in flight can't be resumed mid-way, so it shows as failed (retry works). */
export function recoverInterrupted(job) {
  let changed = false;
  for (const k of STAGE_KEYS) if (job.stages[k].status === 'running') { failRun(job, k, 'Interrupted: the app was closed during the run'); changed = true; }
  return changed;
}

/** Edits from the UI → stored edit lines. kinds: general | pin | card | answer. */
export function normaliseEdits(edits) {
  return (Array.isArray(edits) ? edits : [edits])
    .map((e) => (typeof e === 'string' ? { kind: 'general', text: e } : e))
    .filter((e) => e && typeof e.text === 'string' && e.text.trim())
    .map((e) => {
      const out = { kind: ['general', 'pin', 'card', 'answer'].includes(e.kind) ? e.kind : 'general', text: e.text.trim() };
      if (e.page != null) out.page = +e.page;
      if (e.x != null) out.x = Math.round(+e.x);
      if (e.y != null) out.y = Math.round(+e.y);
      if (e.card) out.card = String(e.card);
      if (e.file) out.file = String(e.file);
      if (e.qid) out.qid = String(e.qid);
      if (e.standing) out.standing = true;
      return out;
    });
}

function mergeQuestions(job, stage, questions) {
  for (const q of questions) {
    const id = `${stage}:${q.id}`;
    const cur = job.questions.find((x) => x.id === id);
    if (cur) Object.assign(cur, { text: q.text, blocking: !!q.blocking });
    else job.questions.push({ id, stage, qid: q.id, text: q.text, blocking: !!q.blocking, answer: null });
  }
}

/** One-word status for lists and chips. */
export function jobStatus(job) {
  if (job.status === 'draft') return 'draft';
  if (job.status === 'done') return 'done';
  const statuses = STAGE_KEYS.map((k) => job.stages[k].status);
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('awaiting_review')) {
    const open = job.questions.some((q) => q.blocking && q.answer == null && job.stages[q.stage]?.status === 'awaiting_review');
    return open ? 'question' : 'awaiting_review';
  }
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('editing') || statuses.includes('pending')) return 'queued';
  return job.status;
}
