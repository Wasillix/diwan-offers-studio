// "Start with Windows": a small hidden-window launcher in the user's Startup folder that runs the Studio
// at sign-in and appends its output to data/server.log. Turned on/off from Settings; nothing else is changed.
import fs from 'node:fs';
import path from 'node:path';

const NAME = 'Diwan Offers Studio.vbs';

export function startupDir() {
  return process.env.STARTUP_DIR || path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

export function launcherScript({ root, node = process.execPath, dataDir }) {
  const q = (s) => s.replace(/"/g, '""');
  const cmd = `cmd /c ""${q(node)}" "${q(path.join(root, 'server', 'index.js'))}" >> "${q(path.join(dataDir, 'server.log'))}" 2>&1"`;
  return `' Starts Diwan Offers Studio at sign-in (created from the Studio's Settings; delete to stop).\r\n`
    + `Set sh = CreateObject("WScript.Shell")\r\n`
    + `sh.CurrentDirectory = "${q(root)}"\r\n`
    + `sh.Run "${q(cmd)}", 0, False\r\n`;
}

export class Startup {
  constructor(config, dir = startupDir()) { this.config = config; this.dir = dir; this.file = path.join(dir, NAME); }
  status() { return { enabled: fs.existsSync(this.file), file: this.file, supported: process.platform === 'win32' || !!process.env.STARTUP_DIR }; }
  enable() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, launcherScript({ root: this.config.root, dataDir: this.config.dataDir }), 'utf8');
    return this.status();
  }
  disable() { fs.rmSync(this.file, { force: true }); return this.status(); }
}
