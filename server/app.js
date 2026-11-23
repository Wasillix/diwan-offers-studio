// Express app: JSON API, Server-Sent Events, job files and the Studio UI (web/).
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import * as M from './machine.js';
import { STAGES, DELIVERABLES, STAGE_KEYS } from './stages.js';
import { makeTag } from './store.js';
import { QUICK_STAGES, readCards, planChanges } from './quick.js';
import { saveAttachment, MAX_BYTES } from './attachments.js';
import { libraryFolders, libraryStats, saveToLibrary, undoSave, logLibrary } from './library.js';

import { DEFAULT_TASKS } from './settings.js';
import { toolChecks, folderChecks, authStatus, pickFolder } from './system.js';

export { DEFAULT_TASKS };

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

/**
 * settings, notifier, scheduler, inbox, startup and onAgentMode are optional (tests run without them).
 * pickFolderImpl replaces the Windows folder picker in tests.
 */
export function createApp({ config, store, runner, settings, notifier, scheduler, inbox, startup, onAgentMode, pickFolderImpl = pickFolder }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
  const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });
  const oneImage = (req, res, next) => imageUpload.single('file')(req, res, (e) => {
    if (!e) return next();
    res.status(e.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'The image is over 25 MB.' : e.message });
  });
  const nowIso = () => new Date().toISOString();

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
      res.status(code).json({ error: e.message, ...(e.exists ? { exists: true, rel: e.rel } : {}) });
    }
  };

  // ---- meta
  app.get('/api/status', route(() => ({
    agentMode: config.agentMode, port: config.port,
    paths: { toolkit: config.toolkitDir, imageLibrary: config.imageLibrary, inbox: config.inboxDir, outputs: config.outputsDir, data: config.dataDir },
    busy: runner.active ? { jobId: runner.active.jobId, stage: runner.active.stage } : null, queued: runner.queue.length,
  })));
  app.get('/api/meta', route(() => {
    const nw = settings?.get().newWeek;
    return {
      stages: STAGES, deliverables: DELIVERABLES, looks: listLooks(config.root), agentMode: config.agentMode,
      defaultTasks: nw?.tasks || DEFAULT_TASKS, defaultDeliverables: nw?.deliverables || DELIVERABLES.map((d) => d.key),
      defaultLook: nw?.look || 'classic', defaultOfferName: nw?.offerName || 'Weekend Offers', defaultKickerAr: nw?.kickerAr || 'عروض نهاية الأسبوع',
    };
  }));

  // ---- settings
  const need = (x, what) => { if (!x) throw Object.assign(new Error(`${what} isn't available`), { code: 501 }); return x; };
  const settingsView = () => ({
    settings: settings.get(),
    nextReminder: scheduler?.nextRun() || null,
    startup: startup?.status() || { enabled: false, supported: false },
    telegramConfigured: !!notifier?.telegramConfigured(),
    agentModeForced: process.argv.includes('--mock'),
    folders: folderChecks(settings.get().paths),
    auth: authStatus(store),
    recentNotifications: notifier?.sent.slice(0, 5) || [],
  });
  app.get('/api/settings', route(() => { need(settings, 'Settings'); return settingsView(); }));
  app.get('/api/settings/checks', route((req) => toolChecks({ refresh: req.query.refresh === '1' })));
  app.put('/api/settings', route((req) => {
    need(settings, 'Settings');
    const before = settings.get();
    const patch = { ...(req.body || {}) };
    if (patch.schedule) delete patch.schedule.lastFired; // only the scheduler sets this
    const after = settings.update(patch);
    if (JSON.stringify(before.paths) !== JSON.stringify(after.paths) || before.inbox.enabled !== after.inbox.enabled) inbox?.start();
    if (before.agent.mode !== after.agent.mode) onAgentMode?.(after.agent.mode);
    return settingsView();
  }));
  app.post('/api/settings/startup', route((req) => {
    need(startup, 'Start with Windows');
    return req.body?.enabled ? startup.enable() : startup.disable();
  }));
  app.post('/api/settings/test-notification', route(async () => need(notifier, 'Notifications').send({
    kind: 'test', title: 'Test from Offers Studio', body: 'Notifications are working. This is what you\'ll see when a stage is ready for review.', url: '#/settings',
  }, { force: true })));
  app.post('/api/settings/scan-inbox', route(async () => {
    const jobs = await need(inbox, 'The inbox watcher').scan();
    return { created: jobs.map((j) => ({ id: j.id, offer_name: j.offer_name, dates_en: j.dates_en })) };
  }));
  app.post('/api/settings/run-reminder', route(() => {
    const job = need(scheduler, 'The reminder').fire(new Date().toISOString().slice(0, 10));
    return { job: job ? { id: job.id, dates_en: job.dates_en } : null };
  }));

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

  // ---- quick edits (server/quick.js): prices, names, units, savings applied by the Studio, no agent
  app.get('/api/jobs/:id/cards', route(async (req) => readCards(store.dir(load(req).id, 'build'))));
  app.post('/api/jobs/:id/stages/:stage/quick', route(async (req) => {
    let job = load(req); const stage = stageOf(req, job);
    if (!QUICK_STAGES.includes(stage)) throw new M.MachineError(`quick edits are only for the ${QUICK_STAGES.join(', ')} stage`, 400);
    if (job.stages[stage].status !== 'awaiting_review') throw new M.MachineError(`stage "${stage}" is ${job.stages[stage].status}; quick edits need it awaiting review`);
    const planned = planChanges(req.body?.changes, await readCards(store.dir(job.id, 'build')));
    job = load(req); // fresh copy after the async read
    const round = M.queueQuick(job, stage, planned);
    store.log(job.id, { type: 'app', stage, text: `Quick edit queued (${planned.length} card${planned.length > 1 ? 's' : ''}, no agent)` });
    const v = save(job);
    runner.kick(job.id);
    return { ...v, quickRound: round.n };
  }));

  // ---- images attached to edits (server/attachments.js): saved in the week's attachments/<stage>/
  app.post('/api/jobs/:id/attachments', oneImage, route((req) => {
    const job = load(req);
    const stage = req.body?.stage;
    if (!job.stages[stage]) throw Object.assign(new Error('unknown stage'), { code: 400 });
    if (!req.file) throw Object.assign(new Error('no image in the upload'), { code: 400 });
    // multer reads non-ASCII file names as latin1
    const originalname = Buffer.from(req.file.originalname || 'image', 'latin1').toString('utf8');
    const a = saveAttachment(store.dir(job.id), stage, { ...req.file, originalname });
    store.log(job.id, { type: 'app', stage, text: `Image attached: ${originalname}` });
    return a;
  }));

  // ---- photo library (server/library.js): the Studio files new product photos only when Waseem clicks Save
  app.get('/api/library/folders', route(() => ({ root: config.imageLibrary, folders: libraryFolders(config.imageLibrary) })));
  app.post('/api/jobs/:id/library', route((req) => {
    const job = load(req);
    const { source, folder, name, stage = null, round = null } = req.body || {};
    const saved = saveToLibrary({ lib: config.imageLibrary, jobDir: store.dir(job.id), source, folder, name });
    const entry = { source, target: saved.rel, size: saved.size, stage, round, at: nowIso() };
    job.library = [...(job.library || []), entry];
    logLibrary(config.dataDir, { action: 'add', jobId: job.id, library: config.imageLibrary, ...entry });
    store.log(job.id, { type: 'app', stage, text: `Saved to the photo library: ${saved.rel}${saved.newFolder ? ' (new folder)' : ''}` });
    return { ...save(job), saved: { ...entry, newFolder: saved.newFolder } };
  }));
  app.post('/api/jobs/:id/library/undo', route((req) => {
    const job = load(req);
    const e = (job.library || []).find((x) => x.target === req.body?.target && !x.undoneAt);
    if (!e) throw Object.assign(new Error('The Studio didn\'t add that file for this week.'), { code: 404 });
    const r = undoSave({ lib: config.imageLibrary, rel: e.target, size: e.size, trashDir: path.join(config.dataDir, 'trash', 'library') });
    e.undoneAt = nowIso();
    logLibrary(config.dataDir, { action: 'undo', jobId: job.id, library: config.imageLibrary, target: e.target, movedTo: r.movedTo || null });
    store.log(job.id, { type: 'app', stage: e.stage, text: `Removed from the photo library: ${e.target}${r.movedTo ? ' (kept in data/trash/library)' : ''}` });
    return save(job);
  }));

  // ---- first-run Setup (#/setup) and the Windows folder picker
  const SETUP_PATHS = ['imageLibrary', 'logos', 'inbox', 'outputs'];
  const setupView = () => {
    const s = need(settings, 'Settings').get();
    return { done: !!s.setup?.done, paths: s.paths, folders: folderChecks(s.paths), library: libraryStats(s.paths.imageLibrary), auth: authStatus(store), windows: process.platform === 'win32' };
  };
  app.get('/api/setup', route(() => setupView()));
  app.post('/api/setup', route((req) => {
    const s = need(settings, 'Settings');
    const paths = {};
    for (const k of SETUP_PATHS) {
      const v = String(req.body?.paths?.[k] ?? s.get().paths[k] ?? '').trim().replace(/^"|"$/g, '');
      if (!v || !path.isAbsolute(v)) throw Object.assign(new Error(`Pick a full folder path for ${k === 'imageLibrary' ? 'the photo library' : k}.`), { code: 400 });
      paths[k] = v;
    }
    if (!fs.existsSync(paths.imageLibrary)) throw Object.assign(new Error(`The photo library folder isn't there: ${paths.imageLibrary}`), { code: 400 });
    for (const k of ['inbox', 'outputs']) fs.mkdirSync(paths[k], { recursive: true }); // made for you if new
    s.update({ paths, setup: { done: true, at: nowIso() } });
    inbox?.start();
    return setupView();
  }));
  app.post('/api/system/folder-check', route((req) => {
    const p = String(req.body?.path || '').trim().replace(/^"|"$/g, '');
    return { path: p, ...(p && path.isAbsolute(p) ? libraryStats(p) : { exists: false, images: 0, folders: 0 }) };
  }));
  app.post('/api/system/pick-folder', route(async (req) => ({ path: await pickFolderImpl({ initial: req.body?.initial, title: req.body?.title || 'Choose a folder' }) })));

  // ---- live updates (SSE): /api/events (all weeks) and /api/jobs/:id/events (one week + its log)
  const sse = (req, res, filter, global = false) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const onJob = (job) => { if (filter(job.id)) send('job', view(job)); };
    const onLog = (id, e) => { if (filter(id)) send('log', { jobId: id, ...e }); };
    const onRemoved = (id) => { if (filter(id)) send('removed', { id }); };
    const onNotify = (n) => send('notify', n);
    runner.on('job', onJob); runner.on('log', onLog); runner.on('removed', onRemoved);
    if (global) notifier?.on('notify', onNotify);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => { clearInterval(ping); runner.off('job', onJob); runner.off('log', onLog); runner.off('removed', onRemoved); notifier?.off('notify', onNotify); });
  };
  app.get('/api/events', (req, res) => sse(req, res, () => true, true));
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
