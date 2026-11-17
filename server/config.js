// App configuration: paths, port, agent mode. Values come from .env (git-ignored), then the environment,
// then defaults. `node server/index.js --mock` (npm run mock) forces the mock agent.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TOOLKIT_DIR } from './toolkit.js';

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const dot = loadDotEnv(path.join(ROOT, '.env'));
for (const [k, v] of Object.entries(dot)) if (process.env[k] === undefined && v !== '') process.env[k] = v;
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

export function makeConfig(overrides = {}) {
  const dataDir = overrides.dataDir || env('DATA_DIR', path.join(ROOT, 'data'));
  return {
    root: ROOT,
    port: +env('PORT', 4321),
    agentMode: process.argv.includes('--mock') ? 'mock' : env('AGENT_MODE', 'real'),
    dataDir,
    jobsDir: path.join(dataDir, 'jobs'),
    toolkitDir: env('TOOLKIT_DIR', TOOLKIT_DIR),
    imageLibrary: env('IMAGE_LIBRARY', 'D:\\Diwan\\005 - FMCG Items\\001 - Isolated Items'),
    logosDir: env('LOGOS_DIR', 'D:\\Diwan\\Diwan Offers layouts\\Templates\\Business Units Logo'),
    inboxDir: env('INBOX_DIR', 'D:\\Diwan\\Offers Inbox'),
    outputsDir: env('OUTPUTS_DIR', 'D:\\Diwan\\Claude outputs'),
    webDir: path.join(ROOT, 'web'),
    ...overrides,
  };
}

export const config = makeConfig();
