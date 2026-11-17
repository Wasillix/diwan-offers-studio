// Studio entry: hash router and top bar.
import { $, $$, getMeta } from './lib.js';
import { weeksView } from './views/weeks.js';
import { newWeekView } from './views/new-week.js';
import { weekView } from './views/week.js';

const view = $('#view');
let teardown = null;

const routes = [
  [/^#?\/?$/, () => weeksView(view), 'weeks'],
  [/^#\/new(?:\/([\w-]+))?$/, (m) => newWeekView(view, m[1]), 'new'],
  [/^#\/week\/([\w-]+)(?:\/(\w+))?$/, (m) => weekView(view, m[1], m[2]), 'week'],
];

async function render() {
  if (teardown) { try { teardown(); } catch { /* ignore */ } teardown = null; }
  const lb = $('#lightbox');
  if (!lb.hidden) { lb.hidden = true; lb.innerHTML = ''; }
  const hash = location.hash || '#/';
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
