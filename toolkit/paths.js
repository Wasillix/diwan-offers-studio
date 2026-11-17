// Shared helpers for the render/check scripts: Windows-safe paths and file:// URLs, the week's offer.json.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Build dir: first CLI argument (absolute or relative), else the folder this script sits in.
function buildDir(arg) {
  return path.resolve(arg || __dirname);
}

// file:// URL that works for D:\ paths and folders with spaces.
function fileUrl(dir, name) {
  return pathToFileURL(path.join(dir, name)).href;
}

function ensureDir(...parts) {
  const d = path.join(...parts);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function offer(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'offer.json'), 'utf8'));
}

// Locked type sizes from diwan-brand-rules: a look may never change these.
const LOCKED = { '.card h3': 23.4, '.card .en': 19.7 };

// Playwright's bundled Chromium; if it isn't installed, fall back to Microsoft Edge (same engine,
// always present on Windows 11). PW_CHANNEL=msedge|chrome forces a channel.
async function launch() {
  const { chromium } = require('playwright');
  if (process.env.PW_CHANNEL) return chromium.launch({ channel: process.env.PW_CHANNEL });
  try {
    return await chromium.launch();
  } catch (e) {
    if (!/Executable doesn't exist/.test(String(e))) throw e;
    console.error('bundled Chromium missing, using Microsoft Edge (run: npx playwright install --only-shell chromium)');
    return chromium.launch({ channel: 'msedge' });
  }
}

module.exports = { buildDir, fileUrl, ensureDir, offer, launch, LOCKED, path };
