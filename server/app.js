// Express app: JSON API, Server-Sent Events, job files and the Studio UI (web/).
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import * as M from './machine.js';
import { STAGES, DELIVERABLES, STAGE_KEYS } from './stages.js';
import { makeTag } from './store.js';

// Starting task list for a new week (playbook §5). Settings will make this editable (Phase 5).
export const DEFAULT_TASKS = [
  'Confirm no branch opened or closed',
  'Check app store links still work',
  'List missing, low-res or wrong-size photos for the client',
  'Cover hero: the week\'s biggest saving',
];

const EDITABLE = ['offer_name', 'kicker_ar', 'kicker_en', 'dates_ar', 'dates_en', 'tag', 'look', 'deliverables', 'tasks'];

export function listLooks(root) {
  const d = path.join(root, '.claude', 'skills');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((n) => n.startsWith('diwan-look-')).map((n) => {
    const md = fs.readFileSync(path.join(d, n, 'SKILL.md'), 'utf8');
    const desc = (md.match(/^description:\s*(.+)$/m) || [])[1] || '';
    const title = (md.match(/^#\s+Look:\s*(.+)$/m) || [])[1] || n.slice(11);
    const key = n.slice(11);
    return { key, title, description: desc.trim(), thumb: fs.existsSync(path.join(root, 'web', 'looks', `${key}.png`)) ? `/looks/${key}.png` : null };
  });
}

export function createApp({ config, store, runner }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

  const view = (job) => job && ({
    ...job,
    state: M.jobStatus(job),
    current: M.currentStage(job),
    queuePosition: runner.queuePosition(job.id),
  });
  const load = (req) => {
    const job = store.get(req.params.id);
    if (!job) throw Object.assign(new Error('week not found'), { code: 404 });
    return job;
  };
  const save = (job) => { store.save(job); runner.emit('job', job); return view(job); };
  const route = (fn) => async (req, res) => {
    try { res.json(await fn(req, res)); } catch (e) {
      const code = e instanceof M.MachineError ? e.code : e.code && Number.isInteger(e.code) ? e.code : 500;
      if (code === 500) console.error(e);
      res.status(code).json({ error: e.message });
    }
  };

  // ---- meta
  app.get('/api/status', route(() => ({
    agentMode: config.agentMode, port: config.port,
    paths: { toolkit: config.toolkitDir, imageLibrary: config.imageLibrary, inbox: config.inboxDir, outputs: config.outputsDir, data: config.dataDir },
    busy: runner.active ? { jobId: runner.active.jobId, stage: runner.active.stage } : null, queued: runner.queue.length,
  })));
  app.get('/api/meta', route(() => ({ stages: STAGES, deliverables: DELIVERABLES, looks: listLooks(config.root), defaultTasks: DEFAULT_TASKS, agentMode: config.agentMode })));

  // ---- weeks
  app.get('/api/jobs', route(() => store.list().map((j) => {
    const v = view(j);
    return { id: v.id, offer_name: v.offer_name, dates_en: v.dates_en, dates_ar: v.dates_ar, tag: v.tag, look: v.look, state: v.state,
      current: v.current, cost: v.cost, createdAt: v.createdAt, updatedAt: v.updatedAt, source: v.source,
      stages: Object.fromEntries(STAGE_KEYS.map((k) => [k, v.stages[k].status])) };
  })));

  app.post('/api/jobs', route((req) => {
    const job = store.create(req.body || {}, { copyToolkit: req.query.copyToolkit !== '0' });
    runner.emit('job', job);
    return view(job);
  }));

  app.get('/api/jobs/:id', route((req) => view(load(req))));

  app.patch('/api/jobs/:id', route((req) => {
    const job = load(req);
    if (job.status !== 'draft') throw new M.MachineError('only a draft week can be edited here; send edits on a stage instead');
    for (const k of EDITABLE) if (req.body[k] !== undefined) job[k] = req.body[k];
    if (typeof job.tasks === 'string') job.tasks = job.tasks.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (req.body.tag === '' || ((req.body.offer_name || req.body.dates_en) && req.body.tag === undefined && job.tagAuto !== false)) job.tag = makeTag(job.offer_name, job.dates_en);
    if (req.body.tag) job.tagAuto = false;
    store.writeOfferJson(job);
    return save(job);
  }));

  app.delete('/api/jobs/:id', route((req) => {
    const job = load(req);
    if (runner.isBusy(job.id)) throw new M.MachineError('cancel the run first');
    const trash = path.join(config.dataDir, 'trash');
    fs.mkdirSync(trash, { recursive: true });
    fs.renameSync(store.dir(job.id), path.join(trash, `${job.id}-${Date.now()}`));
    runner.emit('removed', job.id);
    return { ok: true, movedTo: 'data/trash' };
  }));

  app.post('/api/jobs/:id/inputs', upload.array('files'), route((req) => {
    const job = load(req);
    const role = req.body.role || 'sheet';
    for (const f of req.files || []) {
      const name = store.addInput(job.id, f.originalname, f.buffer);
      job.inputs = job.inputs.filter((i) => i.name !== name);
      job.inputs.push({ name, role, size: f.size, addedAt: new Date().toISOString() });
    }
    return save(job);
  }));

  app.delete('/api/jobs/:id/inputs/:name', route((req) => {
    const job = load(req);
    const name = path.basename(req.params.name);
    fs.rmSync(store.dir(job.id, 'inputs', name), { force: true });
    job.inputs = job.inputs.filter((i) => i.name !== name);
    return save(job);
  }));

  app.post('/api/jobs/:id/confirm', route((req) => {
    const job = load(req);
    M.confirm(job);
    store.writeOfferJson(job);
    const v = save(job);
    store.log(job.id, { type: 'app', text: `Week confirmed: look ${job.look}, deliverables ${job.deliverables.join(', ')}` });
    runner.kick(job.id);
    return v;
  }));

  app.post('/api/jobs/:id/cancel', route((req) => {
    const job = load(req);
    return { result: runner.cancel(job.id) };
  }));

  app.get('/api/jobs/:id/log', route((req) => store.readLog(load(req).id, { limit: +req.query.limit || 500 })));

  // ---- stages
  const stageOf = (req, job) => {
    if (!job.stages[req.params.stage]) throw Object.assign(new Error('unknown stage'), { code: 404 });
    return req.params.stage;
  };

  app.get('/api/jobs/:id/stages/:stage/review', route((req) => {
    const job = load(req); const stage = stageOf(req, job);
    const n = +req.query.round;
    const review = n ? store.readRoundReview(job.id, stage, n) : (store.readRoundReview(job.id, stage, job.stages[stage].rounds.filter((r) => r.finishedAt && !r.error).at(-1)?.n) || null);
    if (!review) throw Object.assign(new Error('no review yet'), { code: 404 });
    return review;
  }));

  app.put('/api/jobs/:id/stages/:stage/pending', route((req) => {
    const job = load(req); const stage = stageOf(req, job);
    job.stages[stage].pendingEdits = M.normaliseEdits(req.body.edits || []);
    return save(job);
  }));

  const act = (fn) => route((req) => {
    const job = load(req); const stage = stageOf(req, job);
    const extra = fn(job, stage, req.body || {});
    const v = save(job);
    runner.kick(job.id);
    return extra ? { ...v, ...extra } : v;
  });

  app.post('/api/jobs/:id/stages/:stage/edits', act((job, stage, body) => {
    M.sendEdits(job, stage, body.edits ?? job.stages[stage].pendingEdits);
    store.log(job.id, { type: 'app', stage, text: `Edits sent (${job.stages[stage].rounds.at(-1).edits.length})` });
  }));
  app.post('/api/jobs/:id/stages/:stage/approve', act((job, stage) => {
    M.approve(job, stage);
    store.log(job.id, { type: 'app', stage, text: `✔ ${stage} approved` });
  }));
  app.post('/api/jobs/:id/stages/:stage/retry', act((job, stage) => {
    if (job.stages[stage].status !== 'failed') throw new M.MachineError(`stage "${stage}" hasn't failed`);
    job.stages[stage].retry = true;
    store.log(job.id, { type: 'app', stage, text: `Retry ${stage}` });
  }));
  app.post('/api/jobs/:id/stages/:stage/reopen', act((job, stage, body) => {
    const rerun = M.reopen(job, stage, body.edits);
    store.log(job.id, { type: 'app', stage, text: `Reopened ${stage}${rerun.length ? `; will rebuild ${rerun.join(', ')}` : ''}` });
    return { rerun };
  }));

  // ---- live updates (SSE): /api/events (all weeks) and /api/jobs/:id/events (one week + its log)
  const sse = (req, res, filter) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const onJob = (job) => { if (filter(job.id)) send('job', view(job)); };
    const onLog = (id, e) => { if (filter(id)) send('log', { jobId: id, ...e }); };
    const onRemoved = (id) => { if (filter(id)) send('removed', { id }); };
    runner.on('job', onJob); runner.on('log', onLog); runner.on('removed', onRemoved);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => { clearInterval(ping); runner.off('job', onJob); runner.off('log', onLog); runner.off('removed', onRemoved); });
  };
  app.get('/api/events', (req, res) => sse(req, res, () => true));
  app.get('/api/jobs/:id/events', (req, res) => sse(req, res, (id) => id === req.params.id));

  // ---- files in a job folder (review images, PDFs, mobile HTML…)
  app.get('/files/:id/*', (req, res) => {
    let base;
    try { base = store.dir(req.params.id); } catch { return res.sendStatus(400); }
    const rel = req.params[0];
    const full = path.resolve(base, rel);
    if (!full.startsWith(path.resolve(base) + path.sep) || !fs.existsSync(full)) return res.sendStatus(404);
    res.sendFile(full, { dotfiles: 'deny' });
  });

  // ---- Studio UI
  app.use('/fonts', express.static(path.join(config.toolkitDir, 'fonts')));
  if (fs.existsSync(config.webDir)) {
    app.use(express.static(config.webDir, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
    app.get(/^\/(?!api|files).*/, (req, res) => res.sendFile(path.join(config.webDir, 'index.html')));
  }
  return app;
}
