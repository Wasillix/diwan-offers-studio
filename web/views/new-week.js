// New week (or edit a draft): name, dates, look, deliverables, the offer sheet, and the task list.
import { $, $$, esc, api, get, post, getMeta, toast } from '../lib.js';

const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Two dates → "20 - 23 تشرين الثاني" and "20 – 23 November 2026" (house style). */
export function formatDates(a, b) {
  const d1 = new Date(a), d2 = new Date(b || a);
  const [m1, m2] = [d1.getMonth(), d2.getMonth()];
  if (+d1 === +d2) return { ar: `${d1.getDate()} ${AR_MONTHS[m1]}`, en: `${d1.getDate()} ${EN_MONTHS[m1]} ${d1.getFullYear()}` };
  if (m1 === m2) return { ar: `${d1.getDate()} - ${d2.getDate()} ${AR_MONTHS[m1]}`, en: `${d1.getDate()} – ${d2.getDate()} ${EN_MONTHS[m1]} ${d2.getFullYear()}` };
  return { ar: `${d1.getDate()} ${AR_MONTHS[m1]} - ${d2.getDate()} ${AR_MONTHS[m2]}`, en: `${d1.getDate()} ${EN_MONTHS[m1]} – ${d2.getDate()} ${EN_MONTHS[m2]} ${d2.getFullYear()}` };
}

function makeTag(name, datesEn) {
  const word = (String(name || 'Offers').replace(/\b(offers?|deals?)\b/gi, '').trim() || 'Offers')
    .split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join('').replace(/[^A-Za-z0-9]/g, '');
  const m = String(datesEn || '').match(/(\d{1,2})\s*(?:[A-Za-z]+\s*)?(?:[^\dA-Za-z\s]{1,3}|to)\s*(\d{1,2})\s+([A-Za-z]{3})/);
  if (m) return `${word}-${m[1]}-${m[2]}${m[3][0].toUpperCase()}${m[3].slice(1, 3).toLowerCase()}`;
  const one = String(datesEn || '').match(/(\d{1,2})\s+([A-Za-z]{3})/);
  return word + (one ? `-${one[1]}${one[2][0].toUpperCase()}${one[2].slice(1, 3).toLowerCase()}` : '');
}

const ROLES = [
  { key: 'sheet', label: 'Offer sheet', hint: 'Diwan\'s Excel (.xlsx)', accept: '.xlsx,.xls,.csv' },
  { key: 'produce', label: 'Produce price list', hint: 'Optional, LBP prices', accept: '.xlsx,.xls,.csv' },
  { key: 'images', label: 'Extra images', hint: 'Optional, new product photos', accept: 'image/*', multiple: true },
];

export async function newWeekView(root, draftId) {
  const meta = await getMeta();
  const weeks = await get('/api/jobs');
  let job = draftId ? await get(`/api/jobs/${draftId}`).catch(() => null) : null;
  if (draftId && (!job || job.status !== 'draft')) { location.hash = job ? `#/week/${job.id}` : '#/new'; return; }

  const recent = weeks.filter((w) => w.state !== 'draft').slice(0, 2).map((w) => w.look);
  const state = {
    offer_name: job?.offer_name || 'Weekend Offers',
    kicker_ar: job?.kicker_ar || 'عروض نهاية الأسبوع',
    kicker_en: job?.kicker_en || job?.offer_name || 'Weekend Offers',
    dates_ar: job?.dates_ar || '', dates_en: job?.dates_en || '',
    tag: job?.tag || '', tagAuto: !job || job.tagAuto !== false,
    look: job?.look || 'classic',
    deliverables: job?.deliverables || meta.deliverables.map((d) => d.key),
    tasks: (job?.tasks?.length ? job.tasks : meta.defaultTasks).join('\n'),
    files: { sheet: [], produce: [], images: [] }, // File objects not uploaded yet
  };

  root.innerHTML = `<section class="page">
    <div class="page-head"><div>
      <h1>${job ? 'Draft week' : 'New week'}</h1>
      <p class="lede">${job?.source === 'inbox' ? 'Created from a sheet in the Offers Inbox. Check the dates and look, then start.' : 'Fill in the week, attach Diwan\'s sheet and start. The agent stops for your review after every stage.'}</p>
    </div></div>
    <form class="form" id="wk-form" novalidate>
      <div>
        <div class="panel">
          <h2>The week</h2>
          <div class="row2">
            <div class="field"><label for="f-name">Offer name</label><input class="input" id="f-name" name="offer_name" required></div>
            <div class="field"><label for="f-kar">Cover kicker (Arabic)</label><input class="input ar" id="f-kar" name="kicker_ar" dir="rtl"></div>
          </div>
          <div class="row2">
            <div class="field"><label for="f-from">From</label><input class="input" type="date" id="f-from"></div>
            <div class="field"><label for="f-to">To</label><input class="input" type="date" id="f-to"></div>
          </div>
          <div class="row2">
            <div class="field"><label for="f-dar">Dates in Arabic</label><input class="input ar" id="f-dar" name="dates_ar" dir="rtl" placeholder="20 - 23 تشرين الثاني"><small>Filled from the dates above. Edit if needed.</small></div>
            <div class="field"><label for="f-den">Dates in English</label><input class="input" id="f-den" name="dates_en" placeholder="20 – 23 November 2026"></div>
          </div>
          <div class="field"><label for="f-tag">File tag</label><input class="input num" id="f-tag" name="tag"><small>Used in every file name, like <span class="num">Diwan-<b id="tag-eg"></b>_Interactive.pdf</span>.</small></div>
        </div>

        <div class="panel">
          <h2>Look</h2>
          <div class="looks" id="looks" role="group" aria-label="Design look">
            ${meta.looks.map((l) => `<button type="button" class="look" data-look="${esc(l.key)}" aria-pressed="false">
              <div class="look-art ${esc(l.key)}" aria-hidden="true"></div>
              <b>${esc(l.title)}</b><span>${esc(lookBlurb(l))}</span></button>`).join('')}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="surprise" style="margin-top:10px">Surprise me</button>
          <small class="muted" id="surprise-note"></small>
        </div>

        <div class="panel">
          <h2>Files</h2>
          ${ROLES.map((r) => `<div class="field">
            <span class="legend">${esc(r.label)}</span>
            <label class="drop" data-role="${r.key}"><input type="file" hidden accept="${r.accept}" ${r.multiple ? 'multiple' : ''}>
              <b>Drop ${r.multiple ? 'files' : 'the file'} here</b> or click to choose · <span class="muted">${esc(r.hint)}</span></label>
            <ul class="files-list" data-list="${r.key}"></ul></div>`).join('')}
        </div>

        <div class="panel">
          <h2>Tasks for the agent</h2>
          <div class="field"><label for="f-tasks">One task per line. Anything extra this week: client notes, photo swaps, a cover hero.</label>
            <textarea class="input" id="f-tasks" rows="6"></textarea></div>
        </div>
      </div>

      <aside class="side-sticky">
        <div class="panel">
          <h2>Deliverables</h2>
          <div class="checks" id="deliv">${meta.deliverables.map((d) => `<label class="check"><input type="checkbox" value="${esc(d.key)}"> ${esc(d.label)}</label>`).join('')}</div>
          <p class="muted" id="skips" style="font-size:12.5px;margin:12px 0 0"></p>
        </div>
        <div class="panel">
          <ul class="summary-list" id="summary"></ul>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" id="start">Start week</button>
            <button class="btn" type="button" id="save">Save draft</button>
            ${job ? '<button class="btn btn-ghost" type="button" id="discard">Discard draft</button>' : ''}
          </div>
          <p class="form-error" id="err" hidden></p>
        </div>
      </aside>
    </form></section>`;

  const f = (id) => $(`#${id}`, root);
  f('f-name').value = state.offer_name; f('f-kar').value = state.kicker_ar;
  f('f-dar').value = state.dates_ar; f('f-den').value = state.dates_en; f('f-tasks').value = state.tasks;
  $$('#deliv input', root).forEach((c) => { c.checked = state.deliverables.includes(c.value); });

  function syncTag() {
    if (state.tagAuto) state.tag = makeTag(state.offer_name, state.dates_en);
    f('f-tag').value = state.tag; f('tag-eg').textContent = state.tag || 'Tag';
  }
  function syncLook() {
    $$('.look', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === state.look)));
  }
  function syncSummary() {
    const sheet = state.files.sheet[0]?.name || job?.inputs?.find((i) => i.role === 'sheet')?.name;
    const look = meta.looks.find((l) => l.key === state.look);
    const skip = meta.stages.filter((s) => s.needs && !s.needs.some((d) => state.deliverables.includes(d))).map((s) => s.label);
    f('skips').textContent = skip.length ? `Skipped this week: ${skip.join(', ')}.` : 'Every stage runs this week.';
    f('summary').innerHTML = [
      ['Week', state.offer_name || '—'], ['Dates', state.dates_en || '—'], ['Look', look?.title || state.look],
      ['Sheet', sheet || 'Not attached'], ['Deliverables', `${state.deliverables.length} of ${meta.deliverables.length}`],
    ].map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('');
  }
  function syncFiles() {
    for (const r of ROLES) {
      const uploaded = (job?.inputs || []).filter((i) => i.role === r.key).map((i) => ({ name: i.name, uploaded: true }));
      const local = state.files[r.key].map((file, i) => ({ name: file.name, i }));
      $(`[data-list="${r.key}"]`, root).innerHTML = [...uploaded, ...local].map((x) => `<li><span>${esc(x.name)}</span>
        ${x.uploaded ? '<small class="muted">attached</small>' : ''}
        <button type="button" class="edit-x" aria-label="Remove ${esc(x.name)}" data-rm-role="${r.key}" ${x.uploaded ? `data-rm-up="${esc(x.name)}"` : `data-rm-i="${x.i}"`}>×</button></li>`).join('');
    }
    syncSummary();
  }

  syncTag(); syncLook(); syncFiles();

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'f-name') { state.offer_name = t.value; if (!job || state.kicker_en === job?.offer_name) state.kicker_en = t.value; syncTag(); }
    if (t.id === 'f-kar') state.kicker_ar = t.value;
    if (t.id === 'f-dar') state.dates_ar = t.value;
    if (t.id === 'f-den') { state.dates_en = t.value; syncTag(); }
    if (t.id === 'f-tag') { state.tag = t.value; state.tagAuto = !t.value; if (!t.value) syncTag(); f('tag-eg').textContent = state.tag; }
    if (t.id === 'f-tasks') state.tasks = t.value;
    if (t.id === 'f-from' || t.id === 'f-to') {
      const a = f('f-from').value, b = f('f-to').value || a;
      if (a) {
        if (!f('f-to').value) f('f-to').value = a;
        const d = formatDates(a, b);
        state.dates_ar = d.ar; state.dates_en = d.en; f('f-dar').value = d.ar; f('f-den').value = d.en; syncTag();
      }
    }
    syncSummary();
  });
  root.addEventListener('change', (e) => {
    if (e.target.closest('#deliv')) { state.deliverables = $$('#deliv input:checked', root).map((c) => c.value); syncSummary(); }
    if (e.target.type === 'file') { addFiles(e.target.closest('.drop').dataset.role, e.target.files); e.target.value = ''; }
  });
  root.addEventListener('click', async (e) => {
    const lk = e.target.closest('.look');
    if (lk) { state.look = lk.dataset.look; syncLook(); syncSummary(); f('surprise-note').textContent = ''; }
    if (e.target.id === 'surprise') {
      const pool = meta.looks.map((l) => l.key).filter((k) => !recent.includes(k));
      state.look = pool[Math.floor(Math.random() * pool.length)] || state.look;
      syncLook(); syncSummary();
      f('surprise-note').textContent = recent.length ? ` Not used in the last ${recent.length} week${recent.length > 1 ? 's' : ''}.` : '';
    }
    const rm = e.target.closest('[data-rm-role]');
    if (rm) {
      if (rm.dataset.rmUp) { job = await api('DELETE', `/api/jobs/${job.id}/inputs/${encodeURIComponent(rm.dataset.rmUp)}`); }
      else state.files[rm.dataset.rmRole].splice(+rm.dataset.rmI, 1);
      syncFiles();
    }
    if (e.target.id === 'save') save(false);
    if (e.target.id === 'discard' && confirm('Discard this draft? It moves to data/trash.')) {
      await api('DELETE', `/api/jobs/${job.id}`); location.hash = '#/';
    }
  });
  $$('.drop', root).forEach((d) => {
    d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('over'); });
    d.addEventListener('dragleave', () => d.classList.remove('over'));
    d.addEventListener('drop', (e) => { e.preventDefault(); d.classList.remove('over'); addFiles(d.dataset.role, e.dataTransfer.files); });
  });
  f('wk-form').addEventListener('submit', (e) => { e.preventDefault(); save(true); });

  function addFiles(role, list) {
    const files = [...list];
    if (!files.length) return;
    const r = ROLES.find((x) => x.key === role);
    state.files[role] = r.multiple ? [...state.files[role], ...files] : [files[0]];
    syncFiles();
  }

  async function save(start) {
    const err = f('err'); err.hidden = true;
    if (start) {
      const missing = [];
      if (!state.offer_name.trim()) missing.push('the offer name');
      if (!state.dates_ar.trim() || !state.dates_en.trim()) missing.push('the dates in Arabic and English');
      if (!state.deliverables.length) missing.push('at least one deliverable');
      const hasSheet = state.files.sheet.length || job?.inputs?.some((i) => i.role === 'sheet');
      if (missing.length) { err.textContent = `Add ${missing.join(', ')} to start.`; err.hidden = false; return; }
      if (!hasSheet && !confirm('No offer sheet attached. Start anyway? The intake stage will ask for it.')) return;
    }
    const body = {
      offer_name: state.offer_name.trim(), kicker_ar: state.kicker_ar.trim(), kicker_en: state.kicker_en.trim() || state.offer_name.trim(),
      dates_ar: state.dates_ar.trim(), dates_en: state.dates_en.trim(), look: state.look, deliverables: state.deliverables,
      tasks: state.tasks.split('\n').map((s) => s.trim()).filter(Boolean),
      ...(state.tagAuto ? {} : { tag: state.tag.trim() }),
    };
    const btns = $$('.form-actions .btn', root); btns.forEach((b) => { b.disabled = true; });
    try {
      job = job ? await api('PATCH', `/api/jobs/${job.id}`, body) : await post('/api/jobs', body);
      for (const r of ROLES) if (state.files[r.key].length) {
        const fd = new FormData();
        fd.append('role', r.key);
        state.files[r.key].forEach((file) => fd.append('files', file));
        job = await api('POST', `/api/jobs/${job.id}/inputs`, fd);
        state.files[r.key] = [];
      }
      if (start) {
        await post(`/api/jobs/${job.id}/confirm`);
        toast('Week started. Intake is running.');
        location.hash = `#/week/${job.id}`;
      } else {
        toast('Draft saved');
        if (!draftId) location.hash = `#/new/${job.id}`; else syncFiles();
      }
    } catch (e2) {
      err.textContent = e2.message; err.hidden = false;
    } finally { btns.forEach((b) => { b.disabled = false; }); }
  }
}

function lookBlurb(l) {
  return {
    classic: 'House style the client knows. Red banners, paper cards.',
    'market-bold': 'Big-sale energy. Yellow bursts, diagonal red bands.',
    editorial: 'Calm and premium. Whitespace, halo circles, red numerals.',
    seasonal: 'Themed for the occasion: Ramadan, Eid, Christmas, 22 Nov.',
  }[l.key] || l.description.split(' - ')[1] || l.description;
}
