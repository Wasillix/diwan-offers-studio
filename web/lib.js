// Shared helpers: API calls, live events, escaping, formatting, toasts.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const HAS_AR = /[؀-ۿ]/;
const FIRST_STRONG = /[A-Za-z؀-ۿ]/;
const AR_RUN = /[؀-ۿ][؀-ۿً-ٟ\s\d.,%$\-–()]*[؀-ۿ]|[؀-ۿ]/g;
/** Arabic text renders right-to-left in Madani. An English sentence that quotes Arabic keeps its
 *  direction and only the Arabic runs are isolated, so the words don't get reordered. */
export function txt(s) {
  s = String(s ?? '');
  if (!HAS_AR.test(s)) return esc(s);
  if ((s.match(FIRST_STRONG) || [''])[0].match(/[؀-ۿ]/)) return `<span class="ar" dir="rtl">${esc(s)}</span>`;
  let out = '', last = 0;
  for (const m of s.matchAll(AR_RUN)) {
    out += esc(s.slice(last, m.index)) + `<bdi class="ar" dir="rtl">${esc(m[0])}</bdi>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}

export async function api(method, path, body) {
  const opt = { method, headers: {} };
  if (body instanceof FormData) opt.body = body;
  else if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(path, opt);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
  return data;
}
export const get = (p) => api('GET', p);
export const post = (p, b) => api('POST', p, b ?? {});

let meta;
export async function getMeta() {
  if (!meta) meta = await get('/api/meta');
  return meta;
}

/** Live updates. Returns a close() function. */
export function listen(path, handlers) {
  const es = new EventSource(path);
  for (const [ev, fn] of Object.entries(handlers)) es.addEventListener(ev, (e) => fn(JSON.parse(e.data)));
  return () => es.close();
}

export const STATE_LABEL = {
  draft: 'Draft', queued: 'Queued', running: 'Working', awaiting_review: 'Ready for review', question: 'Has a question',
  failed: 'Failed', done: 'Delivered', active: 'In progress',
};
export const STAGE_STATUS = {
  pending: 'Not started', running: 'Working', awaiting_review: 'Ready for review', editing: 'Edits queued',
  approved: 'Approved', skipped: 'Skipped', failed: 'Failed',
};

export function chip(state, label) {
  return `<span class="chip s-${esc(state)}">${esc(label || STATE_LABEL[state] || STAGE_STATUS[state] || state)}</span>`;
}

export const money = (n) => (n ? `$${(+n).toFixed(2)}` : '—');

export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const clock = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

let toastTimer;
export function toast(msg, { error = false } = {}) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', error);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, error ? 6000 : 2600);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const fileUrl = (jobId, p) => `/files/${encodeURIComponent(jobId)}/${p.split('/').map(encodeURIComponent).join('/')}`;
