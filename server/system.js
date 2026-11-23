// System checks for Settings: tools the toolkit needs, folders, and how the agent signs in.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { detectPython } from './toolkit.js';
import { runPowerShell } from './powershell.js';

const require = createRequire(import.meta.url);
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, windowsHide: true }); return r.status === 0 ? (r.stdout || r.stderr).trim() : null; };

let cached = null;
export function toolChecks({ refresh = false } = {}) {
  if (cached && !refresh) return cached;
  const out = [];
  out.push({ key: 'node', label: 'Node.js', ok: true, detail: process.version });
  try { const py = detectPython(); out.push({ key: 'python', label: 'Python', ok: true, detail: `${run(py.cmd, [...py.pre, '--version'])} (${[py.cmd, ...py.pre].join(' ')})` }); }
  catch (e) { out.push({ key: 'python', label: 'Python', ok: false, detail: e.message }); }
  const ff = run('ffmpeg', ['-version']);
  out.push({ key: 'ffmpeg', label: 'ffmpeg', ok: !!ff, detail: ff ? ff.split('\n')[0].replace(/ Copyright.*/, '') : 'Not found. Install with: winget install ffmpeg' });
  try {
    const { chromium } = require('playwright');
    const exe = chromium.executablePath();
    const bundled = fs.existsSync(exe);
    out.push({ key: 'browser', label: 'Render browser', ok: true, detail: bundled ? 'Playwright Chromium' : 'Microsoft Edge (Playwright Chromium not installed; npx playwright install --only-shell chromium)' });
  } catch (e) { out.push({ key: 'browser', label: 'Render browser', ok: false, detail: e.message }); }
  cached = out;
  return out;
}

export function folderChecks(paths) {
  return Object.entries({ inbox: 'Offers Inbox', outputs: 'Claude outputs', imageLibrary: 'Photo library', logos: 'Diwan logos', toolkit: 'Toolkit' })
    .map(([k, label]) => ({ key: k, label, path: paths[k], ok: !!paths[k] && fs.existsSync(paths[k]) }));
}

/**
 * The Windows folder picker, opened by the server (a browser can't hand over a real folder path).
 * Resolves the chosen folder, or null if cancelled. Values reach PowerShell through env vars, never the script.
 */
export function pickFolder({ initial = '', title = 'Choose a folder', spawnImpl = spawn, timeoutMs = 10 * 60_000 } = {}) {
  if (process.platform !== 'win32') return Promise.reject(Object.assign(new Error('The folder picker only works on Windows. Type the path instead.'), { code: 501 }));
  // ASCII, one statement per line, values from env vars (see powershell.js). The result line is tagged so
  // nothing else PowerShell prints can be mistaken for the path.
  const script = [
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$owner = New-Object System.Windows.Forms.Form',
    "$owner.TopMost = $true; $owner.ShowInTaskbar = $false; $owner.StartPosition = 'Manual'",
    '$owner.Location = New-Object System.Drawing.Point(-3000, -3000); $owner.Size = New-Object System.Drawing.Size(1, 1)',
    '$owner.Show(); $owner.Activate()',
    '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$d.Description = $env:PICK_TITLE; $d.ShowNewFolderButton = $true',
    'if ($env:PICK_INITIAL -and (Test-Path -LiteralPath $env:PICK_INITIAL)) { $d.SelectedPath = $env:PICK_INITIAL }',
    "if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output ('PICKED:' + $d.SelectedPath) }",
    '$owner.Close()',
  ].join('\n');
  return runPowerShell(script, {
    sta: true, timeoutMs, spawnImpl, env: { PICK_TITLE: String(title).slice(0, 200), PICK_INITIAL: String(initial || '') },
  }).then((r) => {
    if (r.timedOut) return null;
    const picked = r.out.split(/\r?\n/).find((l) => l.startsWith('PICKED:'));
    if (picked) return picked.slice(7).trim() || null;
    if (r.code !== 0 || r.err.trim()) throw Object.assign(new Error(`The folder picker failed: ${r.err.trim().split('\n')[0] || `exit ${r.code}`}. Type the path instead.`), { code: 500 });
    return null; // cancelled
  }, (e) => { throw Object.assign(new Error(`Couldn't open the folder picker (${e.code || e.message}). Type the path instead.`), { code: 500 }); });
}

/** How the real agent authenticates. Never returns secrets. */
export function authStatus(store) {
  let last = null;
  for (const j of store.list()) for (const s of Object.values(j.stages)) for (const r of s.rounds) {
    if (r.agent && (!last || (r.finishedAt || '') > last.at)) last = { at: r.finishedAt, ...r.agent };
  }
  const apiKey = !!process.env.ANTHROPIC_API_KEY;
  const login = fs.existsSync(path.join(os.homedir(), '.claude', '.credentials.json'));
  return {
    method: apiKey ? 'API key from .env' : login ? 'Claude Code login on this PC' : 'Not signed in',
    ok: apiKey || login,
    lastRun: last ? { at: last.at, model: last.model, source: last.apiKeySource === 'none' ? 'Claude login' : last.apiKeySource } : null,
    hint: apiKey || login ? null : 'Run `claude` once in a terminal and sign in, or put ANTHROPIC_API_KEY in .env.',
  };
}
