// Images on edits (server/attachments.js), filing photos in the library (server/library.js), the Setup API
// and the folder picker, plus the mock agent's photo round.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as M from '../server/machine.js';
import { editLine, editPrompt } from '../server/prompts.js';
import { validateReview } from '../server/review.js';
import { sniffImage, saveAttachment, cleanImages } from '../server/attachments.js';
import { saveToLibrary, undoSave, libraryFolders, libraryStats, cleanName } from '../server/library.js';
import { createApp } from '../server/app.js';
import { Settings } from '../server/settings.js';
import { makeEnv, startWeek, act } from './helpers.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(12)]);
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'diwan-att-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

function fakeLibrary(t) {
  const lib = path.join(tmp(t), '001 - Isolated Items');
  for (const d of ['Dairy & Eggs/Labneh', 'Dairy & Eggs/Cheese Slices', 'Hygiene & Self Care', '.hidden']) fs.mkdirSync(path.join(lib, d), { recursive: true });
  fs.writeFileSync(path.join(lib, 'Dairy & Eggs/Labneh/Taanayel Labneh 500 G.png'), PNG);
  fs.writeFileSync(path.join(lib, 'Hygiene & Self Care/Dettol Soap.jpg'), JPG);
  return lib;
}

test('attachments: real format from the bytes, HEIC and non-images refused, safe names', (t) => {
  assert.equal(sniffImage(PNG), '.png');
  assert.equal(sniffImage(JPG), '.jpg');
  assert.equal(sniffImage(HEIC), '.heic');
  assert.equal(sniffImage(Buffer.from('not an image at all')), null);
  const job = tmp(t);
  const a = saveAttachment(job, 'flyer', { originalname: 'WhatsApp Image 2026-11-23 at 10.15.jpeg', buffer: PNG });
  assert.match(a.path, /^attachments\/flyer\/\d{8}-\d{6}-whatsapp-image-2026-11-23-at-10-15\.png$/, 'extension follows the bytes');
  assert.ok(fs.existsSync(path.join(job, a.path)));
  const b = saveAttachment(job, 'flyer', { originalname: 'صورة.png', buffer: PNG });
  assert.match(b.path, /-image\.png$/, 'Arabic-only name falls back to "image"');
  assert.throws(() => saveAttachment(job, 'flyer', { originalname: 'x.heic', buffer: HEIC }), /HEIC/);
  assert.throws(() => saveAttachment(job, 'flyer', { originalname: 'x.png', buffer: Buffer.from('<svg/>          ') }), /isn't a JPG, PNG or WebP/);
  assert.throws(() => saveAttachment(job, '../x', { originalname: 'x.png', buffer: PNG }), /unknown stage/);
});

test('edits carry images: cleaned paths and roles, photo edits need one, image-only notes allowed', () => {
  assert.deepEqual(cleanImages([
    { path: 'attachments/flyer/a.png', role: 'reference' }, 'attachments/flyer/b.jpg', { path: 'attachments/flyer/a.png' },
    { path: '../secret.png' }, { path: 'build/x.png' }, { path: 'attachments/flyer/c.gif' }, { path: 'attachments/flyer/d.webp', role: 'bogus' },
  ]), [{ path: 'attachments/flyer/a.png', role: 'reference' }, { path: 'attachments/flyer/b.jpg', role: 'markup' }, { path: 'attachments/flyer/d.webp', role: 'markup' }]);
  const out = M.normaliseEdits([
    { kind: 'general', text: '', images: [{ path: 'attachments/flyer/a.png' }] },
    { kind: 'photo', card: 'هاربيك', text: 'Harpic 750 ml', images: [{ path: 'attachments/images/h.png' }] },
    { kind: 'photo', card: 'no image', text: 'dropped' },
    { kind: 'pin', page: 3, x: 10, y: 20, text: 'like this', images: [{ path: 'attachments/flyer/m.jpg', role: 'markup' }] },
    { kind: 'general', text: '' },
  ]);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { kind: 'general', text: 'See the attached image.', images: [{ path: 'attachments/flyer/a.png', role: 'markup' }] });
  assert.deepEqual(out[1], { kind: 'photo', text: 'Harpic 750 ml', images: [{ path: 'attachments/images/h.png', role: 'photo' }], card: 'هاربيك' });
  assert.equal(out[2].images[0].role, 'markup');
});

test('the agent gets absolute image paths, what each image is, and the attachment rules only when needed', () => {
  const jobDir = path.join('D:', 'Diwan', 'Offers Studio', 'data', 'jobs', 'w1');
  const photo = { kind: 'photo', card: 'هاربيك', text: 'Harpic 750 ml', images: [{ path: 'attachments/images/h.png', role: 'photo' }] };
  const line = editLine(photo, jobDir);
  assert.match(line, /^- \[missing photo for "هاربيك"\] Harpic 750 ml\n {2}Images: .*attachments[\\/]images[\\/]h\.png \(new product photo\)$/);
  assert.ok(line.includes(path.join(jobDir, 'attachments', 'images', 'h.png')));
  assert.equal(editLine({ kind: 'general', text: 'Bigger logo' }), '- [general] Bigger logo', 'old edit lines unchanged');
  const job = { stages: {} };
  assert.match(editPrompt(job, 'flyer', { n: 2, edits: [photo] }, jobDir), /Open each one with Read[\s\S]*"library" entry/);
  assert.doesNotMatch(editPrompt(job, 'flyer', { n: 2, edits: [{ kind: 'general', text: 'x' }] }, jobDir), /Open each one with Read/);
});

test('review.json: missing and library lists, bad entries dropped with a warning (the round still passes)', (t) => {
  const jobDir = tmp(t);
  fs.mkdirSync(path.join(jobDir, 'build', 'img'), { recursive: true });
  fs.writeFileSync(path.join(jobDir, 'build', 'img', 'harpic.png'), PNG);
  const { ok, review } = validateReview({
    stage: 'images', round: 2, summary: 'ok',
    missing: [{ card: 'كيري', en: 'Kiri 24' }, { why: 'no name' }],
    library: [
      { source: 'build/img/harpic.png', folder: 'Hygiene & Self Care', name: 'Harpic 750 ML.png' },
      { source: 'build/img/nope.png', folder: 'X', name: 'a.png' },
      { source: 'build/img/harpic.png', folder: '../outside', name: 'a.png' },
      { source: 'build/img/harpic.png', folder: 'X', name: 'sub/a.png' },
      { source: 'D:/abs.png', folder: 'X', name: 'a.png' },
    ],
  }, { stage: 'images', round: 2, jobDir });
  assert.equal(ok, true);
  assert.equal(review.missing.length, 1);
  assert.equal(review.library.length, 1);
  assert.equal(review.warnings.length, 5);
  assert.deepEqual(validateReview({ stage: 'flyer', round: 1, summary: 's' }).review.library, []);
});

test('library: folders, stats, save without overwriting, stays inside the library, undo to trash', (t) => {
  const lib = fakeLibrary(t);
  const jobDir = tmp(t);
  fs.mkdirSync(path.join(jobDir, 'build', 'img'), { recursive: true });
  fs.writeFileSync(path.join(jobDir, 'build', 'img', 'harpic.png'), PNG);
  assert.deepEqual(libraryFolders(lib), ['Dairy & Eggs', 'Dairy & Eggs/Cheese Slices', 'Dairy & Eggs/Labneh', 'Hygiene & Self Care']);
  assert.deepEqual(libraryStats(lib), { exists: true, images: 2, folders: 4 + 1 });
  assert.equal(cleanName('Harpic: Toilet / Cleaner 750 ML.jpg', '.png'), 'Harpic Toilet Cleaner 750 ML.png');

  const s = saveToLibrary({ lib, jobDir, source: 'build/img/harpic.png', folder: 'Hygiene & Self Care', name: 'Harpic Toilet Cleaner 750 ML.png' });
  assert.equal(s.rel, 'Hygiene & Self Care/Harpic Toilet Cleaner 750 ML.png');
  assert.equal(s.newFolder, false);
  assert.ok(fs.existsSync(path.join(lib, 'Hygiene & Self Care', 'Harpic Toilet Cleaner 750 ML.png')));

  assert.throws(() => saveToLibrary({ lib, jobDir, source: 'build/img/harpic.png', folder: 'Hygiene & Self Care', name: 'Harpic Toilet Cleaner 750 ML.png' }),
    (e) => e.code === 409 && e.exists === true, 'never overwrites');
  assert.throws(() => saveToLibrary({ lib, jobDir, source: 'build/img/harpic.png', folder: '../../Windows', name: 'x.png' }), /isn't a folder name/);
  assert.throws(() => saveToLibrary({ lib, jobDir, source: '../../etc/passwd.png', folder: 'Hygiene & Self Care', name: 'x.png' }), /isn't in this week's folder/);
  assert.throws(() => saveToLibrary({ lib, jobDir, source: 'build/img/harpic.png', folder: '', name: 'x.png' }), /Pick a folder/);
  assert.throws(() => saveToLibrary({ lib: path.join(lib, 'nope'), jobDir, source: 'build/img/harpic.png', folder: 'A', name: 'x.png' }), /isn't there/);

  const n = saveToLibrary({ lib, jobDir, source: 'build/img/harpic.png', folder: 'Hygiene & Self Care/Toilet', name: 'Harpic Original.png' });
  assert.equal(n.newFolder, true);

  const trash = path.join(tmp(t), 'trash');
  assert.throws(() => undoSave({ lib, rel: s.rel, size: s.size + 1, trashDir: trash }), /changed since/);
  const u = undoSave({ lib, rel: s.rel, size: s.size, trashDir: trash });
  assert.ok(fs.existsSync(u.movedTo));
  assert.ok(!fs.existsSync(path.join(lib, 'Hygiene & Self Care', 'Harpic Toilet Cleaner 750 ML.png')));
  assert.throws(() => undoSave({ lib, rel: '../../x.png', trashDir: trash }), /outside/);
});

async function serve(t, extra = {}) {
  const env = makeEnv();
  env.config.imageLibrary = extra.lib || env.config.imageLibrary;
  const settings = extra.settings ? new Settings(env.config) : undefined;
  const server = createApp({ ...env, settings, pickFolderImpl: extra.pickFolderImpl }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections?.(); server.close(); env.cleanup(); });
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  const upload = async (id, stage, buf, name) => {
    const fd = new FormData();
    fd.append('stage', stage);
    fd.append('file', new Blob([buf]), name);
    const res = await fetch(`${base}/api/jobs/${id}/attachments`, { method: 'POST', body: fd });
    return { status: res.status, data: await res.json() };
  };
  return { env, settings, base, call, upload };
}

test('API + mock agent: attach a missing item photo, the round suggests a library spot, Save, no overwrite, Undo', async (t) => {
  const lib = fakeLibrary(t);
  const { env, call, upload, base } = await serve(t, { lib });
  let job = await startWeek(env);
  ({ job } = await act(env, job.id, (j) => M.approve(j, 'intake')));
  assert.equal(job.stages.images.status, 'awaiting_review');
  const rv1 = (await call('GET', `/api/jobs/${job.id}/stages/images/review`)).data;
  assert.equal(rv1.missing.length, 2, 'mock images stage lists 2 missing items');

  assert.equal((await upload(job.id, 'images', HEIC, 'IMG_1.HEIC')).status, 415);
  assert.equal((await upload(job.id, 'nope', PNG, 'a.png')).status, 400);
  const up = await upload(job.id, 'images', PNG, 'harpic.png');
  assert.equal(up.status, 200);
  assert.match(up.data.path, /^attachments\/images\/.+\.png$/);
  assert.equal((await fetch(`${base}/files/${job.id}/${up.data.path}`)).status, 200, 'served for the thumbnails');

  const kiri = rv1.missing.find((m) => m.en.startsWith('Harpic')) || rv1.missing[1];
  const put = await call('PUT', `/api/jobs/${job.id}/stages/images/pending`, { edits: [{ kind: 'photo', card: kiri.card, text: kiri.en, images: [{ path: up.data.path }] }] });
  assert.equal(put.data.stages.images.pendingEdits[0].images[0].role, 'photo');
  await call('POST', `/api/jobs/${job.id}/stages/images/edits`, {});
  await env.runner.idle();
  job = env.store.get(job.id);
  assert.equal(job.stages.images.status, 'awaiting_review');
  const prompt = env.store.readLog(job.id).find((l) => l.type === 'prompt' && l.round === 2)?.text || '';
  assert.match(prompt, /missing photo for/);
  assert.ok(prompt.includes(path.join(env.store.dir(job.id), 'attachments', 'images')), 'absolute path in the prompt');

  const rv2 = (await call('GET', `/api/jobs/${job.id}/stages/images/review?round=2`)).data;
  assert.equal(rv2.missing.length, 1, 'the item with a photo is no longer missing');
  assert.equal(rv2.library.length, 1);
  const sug = rv2.library[0];
  assert.equal(sug.folder, 'Hygiene & Self Care');

  const saved = await call('POST', `/api/jobs/${job.id}/library`, { source: sug.source, folder: sug.folder, name: sug.name, stage: 'images', round: 2 });
  assert.equal(saved.status, 200);
  assert.ok(fs.existsSync(path.join(lib, ...saved.data.saved.target.split('/'))));
  assert.equal(saved.data.library.length, 1);
  const again = await call('POST', `/api/jobs/${job.id}/library`, { source: sug.source, folder: sug.folder, name: sug.name });
  assert.equal(again.status, 409);
  assert.equal(again.data.exists, true);
  assert.match(again.data.error, /already in the library/);
  const log = fs.readFileSync(path.join(env.config.dataDir, 'library-log.jsonl'), 'utf8');
  assert.match(log, /"action":"add"/);

  assert.equal((await call('GET', '/api/library/folders')).data.folders.length, 4);
  const undo = await call('POST', `/api/jobs/${job.id}/library/undo`, { target: saved.data.saved.target });
  assert.equal(undo.status, 200);
  assert.ok(undo.data.library[0].undoneAt);
  assert.ok(!fs.existsSync(path.join(lib, ...saved.data.saved.target.split('/'))));
  assert.equal((await call('POST', `/api/jobs/${job.id}/library/undo`, { target: 'Hygiene & Self Care/Dettol Soap.jpg' })).status, 404, 'only files the Studio added');
});

test('Setup API: first run, folder checks, Finish saves the paths, folder picker stub', async (t) => {
  const lib = fakeLibrary(t);
  const picked = [];
  const { call, settings } = await serve(t, { lib, settings: true, pickFolderImpl: async (o) => { picked.push(o); return lib; } });
  let v = (await call('GET', '/api/setup')).data;
  assert.equal(v.done, false);
  assert.ok(Array.isArray(v.folders));
  assert.deepEqual((await call('POST', '/api/system/folder-check', { path: lib })).data, { path: lib, exists: true, images: 2, folders: 5 });
  assert.equal((await call('POST', '/api/system/folder-check', { path: 'relative/path' })).data.exists, false);
  assert.equal((await call('POST', '/api/system/pick-folder', { initial: 'D:\\x', title: 'Pick' })).data.path, lib);
  assert.equal(picked[0].initial, 'D:\\x');

  const root = path.dirname(lib);
  const paths = { imageLibrary: lib, logos: lib, inbox: path.join(root, 'Inbox'), outputs: path.join(root, 'Out') };
  assert.equal((await call('POST', '/api/setup', { paths: { ...paths, imageLibrary: path.join(root, 'missing') } })).status, 400);
  assert.equal((await call('POST', '/api/setup', { paths: { ...paths, outputs: 'relative' } })).status, 400);
  v = (await call('POST', '/api/setup', { paths })).data;
  assert.equal(v.done, true);
  assert.equal(v.library.images, 2);
  assert.ok(fs.existsSync(paths.inbox) && fs.existsSync(paths.outputs), 'inbox and outputs made');
  assert.equal(settings.get().paths.imageLibrary, lib);
});
