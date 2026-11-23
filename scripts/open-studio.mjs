// What the "Diwan Offers Studio" shortcut runs (through Open Studio.vbs, with no window): start the Studio if
// it isn't running yet, then open it in the browser. Update.cmd uses it with --no-browser to restart the Studio.
// Plain Node on purpose: no PowerShell (see server/powershell.js for why). Exits 1 and writes
// data/launch-error.txt when it can't start; Open Studio.vbs shows that text.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const noBrowser = process.argv.includes('--no-browser');

function studioPort() {
  let port = 4321;
  try {
    for (const m of fs.readFileSync(path.join(root, '.env'), 'utf8').matchAll(/^\s*PORT\s*=\s*(\d+)\s*$/gm)) port = +m[1];
  } catch { /* no .env: default port */ }
  return port;
}

async function isUp(port) {
  try { return (await fetch(`http://127.0.0.1:${port}/api/meta`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; }
}

// server.log, unless something still holds it open; then a dated log so the server can start anyway
function openLog() {
  const main = path.join(dataDir, 'server.log');
  try { return { fd: fs.openSync(main, 'a'), file: main }; } catch {
    const file = path.join(dataDir, `server-${new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}.log`);
    return { fd: fs.openSync(file, 'a'), file };
  }
}

const BOM = String.fromCharCode(0xfeff); // so Open Studio.vbs reads the file as UTF-16

function fail(text) {
  try { fs.writeFileSync(path.join(dataDir, 'launch-error.txt'), BOM + text, 'utf16le'); } catch { /* nothing more to do */ }
  console.error(text);
  process.exit(1);
}

const port = studioPort();
fs.mkdirSync(dataDir, { recursive: true });
fs.rmSync(path.join(dataDir, 'launch-error.txt'), { force: true });

if (!(await isUp(port))) {
  const log = openLog();
  const child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd],
  });
  child.on('error', (e) => fail(`The Studio couldn't start: ${e.message}`));
  child.unref();
  fs.closeSync(log.fd);
  let up = false;
  for (let i = 0; i < 80 && !up; i++) { await new Promise((r) => setTimeout(r, 500)); up = await isUp(port); }
  if (!up) fail(`The Studio didn't start. The reason is at the end of:\n${log.file}`);
}

if (!noBrowser) spawn('explorer.exe', [`http://localhost:${port}/`], { detached: true, stdio: 'ignore' }).unref();
console.log(`Diwan Offers Studio is running at http://localhost:${port}`);
