// Studio entry: hash router and top bar.
import { $, $$, getMeta } from './lib.js';
import { weeksView } from './views/weeks.js';
import { newWeekView } from './views/new-week.js';
import { weekView } from './views/week.js';
import { settingsView } from './views/settings.js';
import { setupView } from './views/setup.js';
import { listen } from './lib.js';

const view = $('#view');
let teardown = null;

const routes = [
  [/^#?\/?$/, () => weeksView(view), 'weeks'],
  [/^#\/new(?:\/([\w-]+))?$/, (m) => newWeekView(view, m[1]), 'new'],
  [/^#\/week\/([\w-]+)(?:\/(\w+))?$/, (m) => weekView(view, m[1], m[2]), 'week'],
  [/^#\/settings$/, () => settingsView(view), 'settings'],
  [/^#\/setup$/, () => setupView(view), 'settings'],
];

// First run on this PC: the Setup page until the folders are confirmed once. "Later" skips it for this tab.
let setupDone = false;
async function needsSetup() {
  if (setupDone || sessionStorage.getItem('diwan-setup-later')) return false;
  const v = await fetch('/api/setup').then((r) => (r.ok ? r.json() : { done: true })).catch(() => ({ done: true }));
  setupDone = !!v.done;
  return !setupDone;
}

// Browser notifications while the Studio is open (Settings → Notifications). The server decides what's
// worth a notification; this only shows it, and only when the tab isn't the one in front.
listen('/api/events', {
  notify: (n) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    const note = new Notification(n.title, { body: n.body, tag: n.url });
    note.onclick = () => { window.focus(); location.hash = n.url.split('/').slice(3).join('/') || '#/'; note.close(); };
  },
});

async function render() {
  if (teardown) { try { teardown(); } catch { /* ignore */ } teardown = null; }
  const lb = $('#lightbox');
  if (!lb.hidden) { lb.hidden = true; lb.innerHTML = ''; }
  const hash = location.hash || '#/';
  if (hash !== '#/setup' && await needsSetup()) { location.hash = '#/setup'; return; }
  for (const [re, fn, nav] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
    view.innerHTML = '';
    teardown = (await fn(m)) || null;
    return;
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', render);
getMeta().then((m) => {
  const pill = $('#agent-pill');
  if (m.agentMode === 'mock') { pill.textContent = 'Mock agent'; pill.title = 'Stage results are canned samples (AGENT_MODE=mock)'; pill.hidden = false; }
}).catch(() => {});
render();
