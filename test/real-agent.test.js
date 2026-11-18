// Real agent helpers that don't call the API: the permission guard and the log lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeGuard, toolLine } from '../server/agent/real.js';

const root = 'D:\\Diwan\\Offers Studio';
const jobDir = path.join(root, 'data', 'jobs', '2026-11-20-weekend');
const imageLibrary = 'D:\\Diwan\\005 - FMCG Items\\001 - Isolated Items\\';
const guard = makeGuard({ jobDir, root, imageLibrary });
const allow = async (t, i) => (await guard(t, i)).behavior === 'allow';

test('writes only inside the job folder or diwan-brand-rules', async () => {
  assert.ok(await allow('Write', { file_path: path.join(jobDir, 'review', 'intake', 'review.json') }));
  assert.ok(await allow('Edit', { file_path: path.join(root, '.claude', 'skills', 'diwan-brand-rules', 'SKILL.md') }));
  assert.ok(!(await allow('Edit', { file_path: path.join(root, 'server', 'app.js') })));
  assert.ok(!(await allow('Write', { file_path: path.join(root, 'toolkit', 'build_full.py') })));
  assert.ok(!(await allow('Write', { file_path: 'D:\\Diwan\\005 - FMCG Items\\001 - Isolated Items\\Dairy\\x.png' })));
  assert.ok(!(await allow('Edit', { file_path: path.join(root, '.claude', 'skills', 'diwan-offers-pipeline', 'SKILL.md') })));
  assert.ok(!(await allow('Write', { file_path: jobDir + '-other\\x.txt' })), 'a sibling folder with the same prefix is outside');
});

test('delivery may also write its finals folder and promote cut-outs', async () => {
  const out = 'D:\\Diwan\\Claude outputs\\DryRun-Weekend-6-9Nov';
  const g = makeGuard({ jobDir, root, imageLibrary, extraWrite: [out, path.join(root, 'toolkit', 'img')] });
  assert.equal((await g('Write', { file_path: path.join(out, 'Diwan-DryRun_Interactive.pdf') })).behavior, 'allow');
  assert.equal((await g('Write', { file_path: path.join(root, 'toolkit', 'img', 'new-cutout.png') })).behavior, 'allow');
  assert.equal((await g('Write', { file_path: 'D:\\Diwan\\Claude outputs\\Diwan-Weekend-6-9Nov_Interactive.pdf' })).behavior, 'deny', 'not the outputs root');
  assert.equal((await g('Write', { file_path: path.join(root, 'toolkit', 'build_full.py') })).behavior, 'deny');
});

test('Bash: runs scripts, never changes the photo library or git', async () => {
  assert.ok(await allow('Bash', { command: 'py -3 "D:\\Diwan\\Offers Studio\\data\\jobs\\x\\build\\build_full.py"' }));
  assert.ok(await allow('Bash', { command: 'py -3 -c "import glob; print(glob.glob(r\'D:/Diwan/005 - FMCG Items/**/*.png\'))"' }), 'reading the library is fine');
  assert.ok(await allow('Bash', { command: 'py -3 build/prep_new.py 2>&1' }));
  assert.ok(!(await allow('Bash', { command: 'rm "D:/Diwan/005 - FMCG Items/001 - Isolated Items/Dairy/old.png"' })));
  assert.ok(!(await allow('Bash', { command: 'echo x > "D:/Diwan/005 - FMCG Items/a.txt"' })));
  assert.ok(!(await allow('Bash', { command: 'git push origin main' })));
  assert.ok(!(await allow('WebFetch', { url: 'https://example.com' })));
});

test('log lines', () => {
  assert.equal(toolLine('Bash', { command: 'py -3 build/build_full.py' }), 'Bash · py -3 build/build_full.py');
  assert.equal(toolLine('Write', { file_path: path.join(jobDir, 'review', 'intake', 'review.json') }, jobDir), 'Write · review/intake/review.json');
  assert.equal(toolLine('Skill', { skill: 'diwan-brand-rules' }), 'Skill · diwan-brand-rules');
  assert.equal(toolLine('TodoWrite', { todos: [{ status: 'completed' }, { status: 'pending' }] }), 'TodoWrite · 1/2 done');
});
