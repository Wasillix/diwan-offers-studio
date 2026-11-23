// Runs agent rounds one at a time (a queue if two weeks overlap), streams every message to log.jsonl and to
// listeners (SSE), validates review.json and moves the stage on. Events: 'job' (job), 'log' (jobId, entry).
import { EventEmitter } from 'node:events';
import * as M from './machine.js';
import { promptFor } from './prompts.js';
import { readAndValidate } from './review.js';
import { STAGE_KEYS } from './stages.js';
import { runQuick } from './quick.js';

const agentInfo = (init) => ({
  model: init.model, apiKeySource: init.apiKeySource, version: init.version,
  skills: (init.skills || []).filter((s) => s.startsWith('diwan-')),
});

export class Runner extends EventEmitter {
  constructor({ store, agent, quick = runQuick }) {
    super();
    this.store = store;
    this.agent = agent;
    this.quick = quick; // quick-edit rounds: the Studio re-renders itself, no agent
    this.queue = [];
    this.active = null; // { jobId, stage, controller }
    this._idle = [];
  }

  /** On server start: runs that were in flight show as failed so they can be retried. */
  recover() {
    for (const job of this.store.list()) {
      if (M.recoverInterrupted(job)) {
        this.store.save(job);
        this.store.log(job.id, { type: 'app', text: 'Run interrupted (app closed). Retry to run it again.' });
      }
    }
  }

  /** What should run next for this job: a queued edit round, a requested retry, or the next pending stage. */
  runnable(job) {
    if (job.status === 'draft') return null;
    for (const k of STAGE_KEYS) {
      const s = job.stages[k];
      if (s.status === 'editing') return k;
      if (s.status === 'failed' && s.retry) return k;
    }
    return M.nextStage(job);
  }

  /** Queue the job if it has something to run. */
  kick(jobId) {
    const job = this.store.get(jobId);
    if (!job || !this.runnable(job)) return false;
    if (this.active?.jobId !== jobId && !this.queue.includes(jobId)) this.queue.push(jobId);
    queueMicrotask(() => this._pump());
    return true;
  }

  isBusy(jobId) {
    return this.active?.jobId === jobId || this.queue.includes(jobId);
  }

  queuePosition(jobId) {
    if (this.active?.jobId === jobId) return 0;
    const i = this.queue.indexOf(jobId);
    return i < 0 ? null : i + 1;
  }

  /** Cancel the run in progress for this job (or drop it from the queue). */
  cancel(jobId) {
    if (this.active?.jobId === jobId) { this.active.controller.abort(); return 'aborted'; }
    const i = this.queue.indexOf(jobId);
    if (i >= 0) { this.queue.splice(i, 1); return 'dequeued'; }
    return null;
  }

  /** Resolves when nothing is running or queued (tests). */
  idle() {
    if (!this.active && !this.queue.length) return Promise.resolve();
    return new Promise((res) => this._idle.push(res));
  }

  _log(jobId, entry) {
    const e = this.store.log(jobId, entry);
    this.emit('log', jobId, e);
    return e;
  }

  _save(job) {
    this.store.save(job);
    this.emit('job', job);
  }

  async _pump() {
    if (this.active) return;
    const jobId = this.queue.shift();
    if (!jobId) { this._idle.splice(0).forEach((r) => r()); return; }
    try {
      await this._runOne(jobId);
    } catch (e) {
      this._log(jobId, { type: 'error', text: `runner: ${e.stack || e}` });
    } finally {
      this.active = null;
      // Same job may have more to run (e.g. approve queued the next stage while this ran): check again.
      const job = this.store.get(jobId);
      if (job && this.runnable(job) && !this.queue.includes(jobId)) this.queue.push(jobId);
      queueMicrotask(() => this._pump());
    }
  }

  async _runOne(jobId) {
    const job = this.store.get(jobId);
    const stage = job && this.runnable(job);
    if (!stage) return;
    const s = job.stages[stage];
    const round = M.startRun(job, stage);
    delete s.retry;
    this._save(job);
    const controller = new AbortController();
    this.active = { jobId, stage, controller };
    const jobDir = this.store.dir(jobId);
    const isQuick = round.kind === 'quick';
    this._log(jobId, { type: 'app', stage, round: round.n, text: `▶ ${stage} · round ${round.n}${round.kind === 'rerun' ? ' (rebuild)' : isQuick ? ' (quick edit, no agent)' : ''}` });
    let result, error;
    const onMessage = (m) => this._log(jobId, { stage, round: round.n, ...m });
    try {
      if (isQuick) result = await this.quick({ job, stage, round, jobDir, signal: controller.signal, onMessage });
      else {
        const { prompt, resume } = promptFor(job, stage, round, jobDir);
        result = await this.agent.run({
          job, stage, round, prompt, resume, jobDir,
          sessionId: resume ? s.sessionId : undefined,
          signal: controller.signal,
          onMessage,
        });
      }
    } catch (e) {
      error = controller.signal.aborted ? 'Cancelled' : (e?.message || String(e));
      result = { sessionId: e?.sessionId, cost: e?.cost || 0 }; // a failed real run still costs money
    }
    const fresh = this.store.get(jobId); // the API may have changed other fields meanwhile
    if (!error) {
      const v = readAndValidate(jobDir, stage, round.n);
      if (!v.ok) error = `No valid review.json: ${v.errors.join('; ')}`;
      else {
        this.store.archiveReview(jobId, stage, round.n, v.review);
        const reruns = M.finishRun(fresh, stage, { review: v.review, sessionId: result?.sessionId, cost: result?.cost });
        if (result?.init) fresh.stages[stage].rounds.at(-1).agent = agentInfo(result.init);
        this._log(jobId, { type: 'app', stage, round: round.n, text: `■ ${stage} round ${round.n} ready for review` });
        if (reruns.length) this._log(jobId, { type: 'app', stage, text: `Cards changed: ${reruns.join(', ')} will rebuild` });
      }
    }
    if (error) {
      const tail = this.store.readLog(jobId, { limit: 8 }).map((l) => l.text).filter(Boolean);
      fresh.stages[stage].status = 'running'; // guarantee the transition is legal even if the API touched it
      M.failRun(fresh, stage, error);
      fresh.stages[stage].lastLog = tail;
      if (result?.sessionId) fresh.stages[stage].sessionId = result.sessionId;
      if (result?.cost) {
        fresh.stages[stage].rounds.at(-1).cost = +(((fresh.stages[stage].rounds.at(-1).cost) || 0) + result.cost).toFixed(4);
        fresh.cost = +((fresh.cost || 0) + result.cost).toFixed(4);
      }
      this._log(jobId, { type: 'error', stage, round: round.n, text: error });
    }
    this._save(fresh);
  }
}
