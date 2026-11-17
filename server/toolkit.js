// Toolkit helpers shared by the smoke test and the job runner:
// find Python, copy the toolkit into a build folder, write offer.json, run a toolkit script.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TOOLKIT_DIR = path.join(ROOT, 'toolkit');

// Generated files that never get copied from the toolkit into a build.
const SKIP = new Set(['out', 'out169', 'final', 'review', '__pycache__', 'node_modules']);

let python;
/** The Python 3 command on this machine: `py -3` on Windows if present, else python3 / python. */
export function detectPython() {
  if (python) return python;
  const candidates = process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]];
  for (const [cmd, pre] of candidates) {
    const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' });
    if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return (python = { cmd, pre });
  }
  throw new Error('Python 3 not found (tried py -3, python, python3)');
}

/** Copy the toolkit into `dest` (fresh), then merge `offer` keys into its offer.json. */
export function prepareBuild(dest, offer = {}, src = TOOLKIT_DIR) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !SKIP.has(path.basename(p)) || path.dirname(p) !== src });
  const f = path.join(dest, 'offer.json');
  const cur = JSON.parse(fs.readFileSync(f, 'utf8'));
  fs.writeFileSync(f, JSON.stringify({ ...cur, ...offer }, null, 2) + '\n', 'utf8');
  return dest;
}

/** Env every toolkit run gets: UTF-8 Python on Windows, node_modules from the repo. */
export function toolkitEnv(extra = {}) {
  return { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', NODE_PATH: path.join(ROOT, 'node_modules'), ...extra };
}

/** Run a toolkit script in `dir`. `script` ending in .py runs with Python, .js with Node. */
export function runScript(dir, script, args = [], { timeout = 300_000 } = {}) {
  let cmd, argv;
  if (script.endsWith('.py')) {
    const py = detectPython();
    cmd = py.cmd; argv = [...py.pre, path.join(dir, script), ...args];
  } else {
    cmd = process.execPath; argv = [path.join(dir, script), ...args];
  }
  const r = spawnSync(cmd, argv, { cwd: dir, env: toolkitEnv(), encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || (r.error ? String(r.error) : ''), ok: r.status === 0 };
}

/** Looks the toolkit knows about: one per themes/<look>.css. */
export function listLooks(src = TOOLKIT_DIR) {
  const d = path.join(src, 'themes');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^[a-z0-9-]+\.css$/.test(f) && !f.endsWith('_mobile.css')).map((f) => f.slice(0, -4)) : [];
}
