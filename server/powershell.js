// Runs a small Windows PowerShell script for the Studio (toasts, the folder picker).
//
// The script goes in through stdin (`-Command -`): no -EncodedCommand, no -WindowStyle Hidden and no
// -ExecutionPolicy override. A script host starting a hidden, encoded PowerShell is what malware does, and
// antivirus behaviour monitors act on it: on 23 Nov 2026 Kaspersky (PDM:Trojan.Win32.Generic) removed
// server/index.js after the Studio showed a toast that way. `windowsHide` keeps the console out of sight.
//
// Stdin is read in the console code page, so scripts must be ASCII and take every value (Arabic titles,
// paths) from environment variables. Each statement must fit on one line.
import { spawn } from 'node:child_process';

export function runPowerShell(script, { env = {}, sta = false, timeoutMs = 60_000, spawnImpl = spawn } = {}) {
  if (/[^\x00-\x7F]/.test(script)) return Promise.reject(new Error('PowerShell scripts must be ASCII; pass text in env vars'));
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-NonInteractive', ...(sta ? ['-STA'] : []), '-Command', '-'];
    const p = spawnImpl('powershell.exe', args, { windowsHide: true, env: { ...process.env, ...env } });
    let out = '', err = '', done = false;
    const finish = (fn) => { if (!done) { done = true; clearTimeout(timer); fn(); } };
    const timer = setTimeout(() => finish(() => { try { p.kill(); } catch { /* gone */ } resolve({ code: null, out, err, timedOut: true }); }), timeoutMs);
    p.stdout?.setEncoding?.('utf8');
    p.stderr?.setEncoding?.('utf8');
    p.stdout?.on('data', (d) => { out += d; });
    p.stderr?.on('data', (d) => { err += d; });
    p.on('error', (e) => finish(() => reject(e)));
    p.on('close', (code) => finish(() => resolve({ code, out, err })));
    p.stdin?.on?.('error', () => {}); // the process may exit before reading everything
    p.stdin?.end(`${script.trim().replace(/\r?\n/g, '\r\n')}\r\nexit\r\n`);
  });
}
