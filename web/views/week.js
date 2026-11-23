// One week: run sheet (stages) · proof (the agent's review for a stage and round) · edits rail (+ live log).
import { $, $$, esc, txt, api, get, post, getMeta, listen, chip, money, toast, debounce, clock, fileUrl, STAGE_STATUS } from '../lib.js';
import { openLightbox } from './lightbox.js';

const ICON = { approved: '✓', failed: '!', skipped: '–', awaiting_review: '•' };
const CLIP = '<svg class="ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M21 11.5 12.6 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const KIND_ORDER = ['image', 'table', 'html', 'pdf', 'video', 'text', 'zip'];

export async function weekView(root, id, stageParam) {
  const meta = await getMeta();
  let job;
  try { job = await get(`/api/jobs/${id}`); } catch { root.innerHTML = `<section class="page"><div class="panel empty"><h1>Week not found</h1><p>It may have been discarded.</p><a class="btn" href="#/">Back to weeks</a></div></section>`; return; }
  if (job.status === 'draft') { location.hash = `#/new/${id}`; return; }

  const S = {
    stage: stageParam && job.stages[stageParam] ? stageParam : (job.current || lastActive(job)),
    round: null,        // round being viewed (null = latest finished)
    compare: null,      // round to compare against
    reviews: {},        // `${stage}:${round}` → review
    log: await get(`/api/jobs/${id}/log?limit=400`),
    editingCard: null,
    quick: loadQuick(id),  // unsent quick edits: card key → { field: value } (kept in this browser)
    quickOpen: false,
    qcards: null,          // the week's cards for the quick-edit table
    qfilter: '',
    draftImages: [],       // images on the note being written: [{ path, role, name }]
    photoForm: null,       // missing-item photo form: { card, text, images }
    attachTo: null,        // where the file picker's images go: 'draft' | 'photo' | edit index
    libFolders: null,      // photo library folders for the Save-to-library suggestions
  };
  const stages = meta.stages;
  const sdef = (k) => stages.find((s) => s.key === k);
  const st = () => job.stages[S.stage];
  const finishedRounds = (k = S.stage) => job.stages[k].rounds.filter((r) => r.finishedAt && !r.error);
  const viewedRound = () => S.round || finishedRounds().at(-1)?.n || null;
  const pending = () => st().pendingEdits || [];
  const canEdit = () => ['awaiting_review', 'approved'].includes(st().status) && S.stage !== 'delivery' || st().status === 'awaiting_review';

  root.innerHTML = `<div class="week">
    <nav class="runsheet" id="runsheet" aria-label="Stages"></nav>
    <section class="proof" id="proof" aria-live="polite"></section>
    <aside class="rail"><div class="rail-body" id="rail"></div><div class="decide" id="decide"></div>
      <details class="log" id="log"><summary>Agent log</summary><div class="log-body" id="log-body"></div></details></aside>
    <input type="file" id="att-file" accept="image/png,image/jpeg,image/webp" multiple hidden>
  </div>`;

  // ---------- run sheet
  function drawRunsheet() {
    const dur = job.stages;
    $('#runsheet', root).innerHTML = `
      <div class="wk-title">
        <h1>${esc(job.offer_name)}</h1>
        ${txt(job.dates_ar)}
        <div class="wk-meta"><span class="num">${esc(job.dates_en)}</span></div>
        <div class="wk-meta"><span class="look-tag"><i class="look-dot ${esc(job.look)}"></i>${esc(meta.looks.find((l) => l.key === job.look)?.title || job.look)}</span><span class="num">${esc(job.tag)}</span></div>
      </div>
      <ol class="steps">${stages.map((s, i) => {
        const x = dur[s.key];
        const rounds = x.rounds.length;
        return `<li class="step ${x.status} ${s.key === S.stage ? 'on' : ''}">
          <a href="#/week/${esc(job.id)}/${s.key}" aria-current="${s.key === S.stage ? 'step' : 'false'}">
            <span class="step-ico">${ICON[x.status] || i + 1}</span>
            <span class="step-name">${esc(s.label)}<span class="step-sub">${esc(STAGE_STATUS[x.status])}</span></span>
            ${rounds > 1 ? `<span class="step-round" title="Rounds">R${rounds}</span>` : ''}
          </a></li>`;
      }).join('')}</ol>
      <div class="wk-foot">
        <div>${chip(job.state)}</div>
        <div>Agent cost <b class="num">${money(job.cost)}</b></div>
        ${job.tasks.length ? `<details><summary style="cursor:pointer">Tasks (${job.tasks.length})</summary><ul style="padding-left:18px;margin:6px 0 0">${job.tasks.map((t) => `<li>${txt(t)}</li>`).join('')}</ul></details>` : ''}
        <a href="#/" class="muted" style="font-size:12.5px">All weeks</a>
      </div>`;
  }

  // ---------- proof
  async function review(stage, n) {
    if (!n) return null;
    const k = `${stage}:${n}`;
    if (!S.reviews[k]) S.reviews[k] = await get(`/api/jobs/${job.id}/stages/${stage}/review?round=${n}`).catch(() => null);
    return S.reviews[k];
  }

  async function drawProof() {
    const el = $('#proof', root);
    const s = st(), def = sdef(S.stage);
    const n = viewedRound();
    const rounds = finishedRounds();
    const head = `<div class="proof-head">
      <div><h2>${esc(def.label)}</h2><div class="muted" style="margin-top:2px">${esc(def.short)}</div></div>
      ${rounds.length ? `<div class="rounds" role="group" aria-label="Rounds">
        ${rounds.map((r) => `<button data-round="${r.n}" aria-pressed="${r.n === n && !S.compare}" ${r.kind === 'quick' ? 'title="Quick edit by the Studio, no agent"' : ''}>Round ${r.n}${r.kind === 'quick' ? ' · quick' : ''}</button>`).join('')}
        ${rounds.length > 1 ? `<span class="sep"></span><button data-compare aria-pressed="${!!S.compare}">${S.compare ? `Comparing R${S.compare} ↔ R${n}` : 'Compare rounds'}</button>` : ''}
      </div>` : ''}
    </div>`;
    if (!n) {
      const msg = {
        skipped: 'Skipped this week: none of its deliverables are ticked.',
        pending: 'Not started yet. It runs after the stages before it are approved.',
        running: 'The agent is working on this stage. Results show up here when it stops for review.',
        editing: 'Queued. The agent picks it up next.',
        failed: 'This stage failed before it produced anything to review. Details are on the right.',
      }[s.status] || '';
      el.innerHTML = `${head}<div class="panel empty"><p>${esc(msg)}</p></div>`;
      return;
    }
    const rv = await review(S.stage, n);
    if (!rv) { el.innerHTML = `${head}<div class="panel empty"><p>Couldn't load round ${n}.</p></div>`; return; }
    const cmp = S.compare ? await review(S.stage, S.compare) : null;
    const checks = Object.entries(rv.checks || {});
    const warnKey = /missing|overflow|duplicate|low_res|no_photo/;
    const sent = s.rounds.find((r) => r.n === n)?.edits || [];
    el.innerHTML = `${head}
      <p class="summary">${txt(rv.summary)}</p>
      ${checks.length ? `<div class="stat-row">${checks.map(([k, v]) => `<span class="stat ${warnKey.test(k) && +v > 0 ? 'warn' : ''}"><b class="num">${esc(v)}</b>${esc(k.replace(/_/g, ' '))}</span>`).join('')}</div>` : ''}
      <div class="notes">
        ${sent.length ? `<div class="note sent"><h3>Your edits for round ${n}</h3><ul>${sent.map((e) => `<li><span class="edit-tag k-${e.kind}">${esc(tagText(e))}</span> ${e.card && e.kind !== 'card' ? `${txt(e.card)}: ` : ''}${txt(e.text)}${attThumbs(e.images)}</li>`).join('')}</ul></div>` : ''}
        ${rv.changes?.length ? `<div class="note changes"><h3>Changed in round ${rv.round}</h3><ul>${rv.changes.map((c) => `<li>${txt(c)}</li>`).join('')}</ul></div>` : ''}
        ${rv.assumptions?.length ? `<div class="note assume"><h3>Assumptions</h3><ul>${rv.assumptions.map((c) => `<li>${txt(c)}</li>`).join('')}</ul></div>` : ''}
        ${rv.rules_added?.length ? `<div class="note rules"><h3>Brand rules added</h3><ul>${rv.rules_added.map((c) => `<li>${txt(c)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div id="photos"></div>
      ${quickOn() ? '<div id="quick"></div>' : ''}
      <div id="files"></div>`;
    drawPhotos();
    if (quickOn()) drawQuick();
    await drawFiles($('#files', el), rv, cmp);
  }

  // ---------- images on edits: thumbnails, upload, missing-item photos, filing photos in the library
  const ROLE = { markup: ['Client markup', 'Markup'], photo: ['New product photo', 'Photo'], reference: ['Reference', 'Reference'] };
  const roleOptions = (cur) => Object.entries(ROLE).map(([k, [long, short]]) => `<option value="${k}" title="${long}" ${k === cur ? 'selected' : ''}>${short}</option>`).join('');
  function tagText(e) {
    return e.kind === 'pin' ? `p${e.page}` : e.kind === 'card' ? 'Card' : e.kind === 'answer' ? 'Answer' : e.kind === 'photo' ? 'Photo' : 'Note';
  }
  /** Image thumbnails; `edit` = index in the pending list (adds role pickers and remove buttons). */
  function attThumbs(images, edit = null) {
    if (!images?.length) return '';
    return `<span class="att-thumbs">${images.map((im, j) => `<span class="att">
      <button type="button" class="att-img" data-view-img="${esc(im.path)}" title="${esc(ROLE[im.role]?.[0] || im.role)}${im.name ? ` · ${esc(im.name)}` : ''}"><img src="${fileUrl(job.id, im.path)}" alt="${esc(ROLE[im.role]?.[0] || '')}" loading="lazy"></button>
      ${edit == null ? `<i class="att-role">${esc(ROLE[im.role]?.[1] || im.role)}</i>`
        : `<select class="att-role-pick" data-img-role="${edit}:${j}" aria-label="What this image is">${roleOptions(im.role)}</select>
           <button type="button" class="att-x" data-rm-img="${edit}:${j}" aria-label="Remove image">×</button>`}
    </span>`).join('')}</span>`;
  }

  /** Images on a form that isn't an edit yet (the note draft or the photo form): role pickers + remove. */
  function attDraft(images, where) {
    return `<span class="att-thumbs">${images.map((im, j) => `<span class="att">
      <button type="button" class="att-img" data-view-img="${esc(im.path)}"><img src="${fileUrl(job.id, im.path)}" alt="" loading="lazy"></button>
      ${where === 'photo' ? '<i class="att-role">Photo</i>' : `<select class="att-role-pick" data-draft-role="${j}" aria-label="What this image is">${roleOptions(im.role)}</select>`}
      <button type="button" class="att-x" data-rm-draft="${where}:${j}" aria-label="Remove image">×</button></span>`).join('')}</span>`;
  }

  async function uploadImages(files, role) {
    const list = [...files].filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|heic)$/i.test(f.name));
    if (!list.length) { toast('Only images can be attached (JPG, PNG or WebP).', { error: true }); return []; }
    const out = [];
    for (const f of list) {
      const fd = new FormData();
      fd.append('stage', S.stage);
      fd.append('file', f, f.name || 'pasted-image.png');
      try { const a = await api('POST', `/api/jobs/${job.id}/attachments`, fd); out.push({ path: a.path, role, name: a.name }); }
      catch (e) { toast(e.message, { error: true }); }
    }
    return out;
  }

  /** Route new images to the open photo form, an edit, or the note being written. */
  async function addImages(files, target = S.attachTo) {
    if (!canEdit()) return;
    if (target == null) target = S.photoForm ? 'photo' : 'draft';
    const role = target === 'photo' || (typeof target === 'number' && pending()[target]?.kind === 'photo') ? 'photo' : 'markup';
    toast(`Uploading ${files.length > 1 ? `${files.length} images` : 'the image'}…`);
    const imgs = await uploadImages(files, role);
    if (!imgs.length) return;
    if (target === 'photo' && S.photoForm) { readPhotoForm(); S.photoForm.images.push(...imgs); }
    else if (typeof target === 'number' && pending()[target]) {
      const l = pending().slice();
      l[target] = { ...l[target], images: [...(l[target].images || []), ...imgs].slice(0, 8) };
      return setPending(l);
    } else { readDraft(); S.draftImages.push(...imgs); }
    drawRail();
  }
  // keep what was typed when the rail redraws
  function readDraft() { const t = $('#add-note textarea', root); if (t) S.draftText = t.value; }
  function readPhotoForm() {
    const f = $('#photo-form', root);
    if (f && S.photoForm) { S.photoForm.card = f.elements.card.value; S.photoForm.text = f.elements.text.value; }
  }
  function pickFiles(target) { S.attachTo = target; const inp = $('#att-file', root); inp.value = ''; inp.click(); }

  function openPhotoForm(prefill = {}) {
    readDraft();
    $('#photo-form', root)?.remove(); // a fresh form: don't read the old one's fields back
    S.photoForm = { card: prefill.card || '', text: prefill.text || '', images: [] };
    drawRail();
    $('#photo-form [name="card"]', root)?.focus();
  }

  async function drawPhotos() {
    const el = $('#photos', root);
    if (!el) return;
    const rv = S.reviews[`${S.stage}:${viewedRound()}`];
    const missing = rv?.missing || [];
    const lib = rv?.library || [];
    const added = new Set(pending().filter((e) => e.kind === 'photo').map((e) => e.card));
    let html = '';
    if (missing.length && !S.compare) {
      html += `<div class="fileblock"><div class="fileblock-head"><h3>Missing photos <span class="muted">${missing.length}</span></h3>
        <span class="muted" style="font-size:13px">Attach the client's photo and the agent puts it on the card in the next round.</span></div>
        <div class="cards-wrap"><table class="cards miss"><tbody>${missing.map((m, i) => `<tr>
          <td class="ar" dir="rtl">${esc(m.card || '')}</td>
          <td>${esc(m.en || '')}<div class="codes num">${esc((m.codes || []).join(' '))}</div></td>
          <td class="muted">${esc(m.why || '')}</td>
          <td style="text-align:right">${added.has(m.card || m.en) ? '<span class="ok-txt">✓ Photo in your edits</span>'
            : canEdit() ? `<button class="btn btn-sm" data-missing="${i}">Attach photo</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if (lib.length && !S.compare) {
      const savedOf = (src) => (job.library || []).find((x) => x.source === src && !x.undoneAt);
      html += `<div class="fileblock lib"><div class="fileblock-head"><h3>New photos for the photo library</h3>
        <span class="muted" style="font-size:13px">Check the folder and name, then Save. The Studio copies the photo; nothing in the library is ever overwritten.</span></div>
        <div class="lib-list">${lib.map((l, i) => {
          const sv = savedOf(l.source);
          return `<div class="lib-row ${sv ? 'saved' : ''}">
            <button type="button" class="att-img lib-img" data-view-img="${esc(l.source)}"><img src="${fileUrl(job.id, l.source)}" alt="New photo${l.card ? ` for ${esc(l.card)}` : ''}" loading="lazy"></button>
            <div class="lib-fields">${l.card ? `<div class="ar" dir="rtl">${esc(l.card)}</div>` : ''}
              ${sv ? `<div class="lib-done">Saved to <span class="path">${esc(sv.target)}</span></div>` : `
              <label>Folder <input class="input" list="lib-folders" data-lib-folder="${i}" value="${esc(l.folder)}" aria-label="Folder in the photo library"></label>
              <small class="lib-hint" data-lib-hint="${i}"></small>
              <label>File name <input class="input" data-lib-name="${i}" value="${esc(l.name)}" aria-label="File name"></label>`}
            </div>
            <div class="lib-act">${sv ? `<button class="btn btn-sm btn-ghost" data-lib-undo="${esc(sv.target)}">Undo</button>`
              : `<button class="btn btn-sm btn-primary" data-lib-save="${i}">Save to library</button>`}</div></div>`;
        }).join('')}</div><datalist id="lib-folders"></datalist></div>`;
    }
    el.innerHTML = html;
    if (lib.length) {
      if (!S.libFolders) S.libFolders = await get('/api/library/folders').then((r) => r.folders).catch(() => []);
      const dl = $('#lib-folders', root);
      if (dl) dl.innerHTML = S.libFolders.map((f) => `<option value="${esc(f)}">`).join('');
      for (const inp of $$('[data-lib-folder]', root)) libHint(inp);
    }
  }
  const libKey = (f) => f.trim().replace(/[\\/]+/g, '/').replace(/^\/|\/$/g, '').toLowerCase();
  function libHint(inp) {
    const hint = $(`[data-lib-hint="${inp.dataset.libFolder}"]`, root);
    if (!hint || !S.libFolders) return;
    const known = S.libFolders.some((f) => libKey(f) === libKey(inp.value));
    hint.textContent = inp.value.trim() && !known ? 'New folder: it will be created in the library.' : '';
  }

  async function saveToLibrary(i) {
    const rv = S.reviews[`${S.stage}:${viewedRound()}`];
    const l = rv?.library?.[i];
    if (!l) return;
    const folder = $(`[data-lib-folder="${i}"]`, root).value.trim();
    const nameInp = $(`[data-lib-name="${i}"]`, root);
    const name = nameInp.value.trim();
    if (S.libFolders && !S.libFolders.some((f) => libKey(f) === libKey(folder))
      && !confirm(`"${folder}" isn't a folder in the photo library yet. Create it and save the photo there?`)) return;
    const btn = $(`[data-lib-save="${i}"]`, root); if (btn) btn.disabled = true;
    try {
      const r = await post(`/api/jobs/${job.id}/library`, { source: l.source, folder, name, stage: S.stage, round: viewedRound() });
      job = r;
      if (r.saved.newFolder) S.libFolders = null;
      toast(`Saved to the photo library: ${r.saved.target}`);
      drawPhotos();
    } catch (e) {
      toast(e.message, { error: true });
      if (/already in the library/.test(e.message)) { nameInp.classList.add('bad'); nameInp.focus(); nameInp.select(); }
      if (btn) btn.disabled = false;
    }
  }

  // ---------- quick edits: prices, names, units, savings applied by the Studio itself (no agent, $0)
  function quickOn() {
    return S.stage === 'flyer' && st().status === 'awaiting_review' && !S.compare && (!S.round || S.round === finishedRounds().at(-1)?.n);
  }
  const QF = [['ar', 'Arabic name', 1], ['en', 'English name', 0], ['u_ar', 'Unit', 1], ['u_en', 'Unit (EN)', 0], ['price', 'Price', 0], ['saving', 'Saving', 0]];
  const priceText = (c) => (c.price == null ? '' : c.lbp ? Math.round(c.price).toLocaleString('en-US').replace(/,/g, '.') : (+c.price).toFixed(2));
  const savingText = (c) => (c.save_txt != null ? c.save_txt : c.saving == null ? '' : String(c.saving));
  const origOf = (c, f) => (f === 'price' ? priceText(c) : f === 'saving' ? savingText(c) : c[f] || '');
  const quickCount = () => Object.keys(S.quick).length;

  async function drawQuick() {
    const el = $('#quick', root);
    if (!el) return;
    const n = quickCount();
    el.innerHTML = `<details class="fileblock quick" id="quick-box" ${S.quickOpen || n ? 'open' : ''}>
      <summary><h3>Quick edits</h3><span class="muted">Change a price, name, unit or saving without the agent: the Studio re-renders the flyer in about 15 s, $0.</span></summary>
      <div class="quick-body" id="quick-body">${S.quickOpen || n ? 'Loading the cards…' : ''}</div></details>`;
    if (S.quickOpen || n) await loadQuickCards();
  }

  async function loadQuickCards() {
    const body = $('#quick-body', root);
    try { S.qcards = await get(`/api/jobs/${job.id}/cards`); } catch (e) { if (body) body.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
    const keys = new Set(S.qcards.map((c) => c.key));
    for (const k of Object.keys(S.quick)) if (!keys.has(k)) delete S.quick[k];
    saveQuick();
    drawQuickTable();
  }

  function drawQuickTable() {
    const body = $('#quick-body', root);
    if (!body || !S.qcards) return;
    const q = S.qfilter.trim().toLowerCase();
    const rows = S.qcards.filter((c) => !q || [c.ar, c.en, c.key, c.section_ar, c.section_en].some((v) => String(v || '').toLowerCase().includes(q)));
    let sec = null, out = '';
    for (const c of rows) {
      if (c.section !== sec) { sec = c.section; out += `<tr class="sec"><td colspan="7">${txt(c.section_ar || c.section)} <span class="muted" style="font-weight:500">· ${esc(c.section_en || c.section)}</span></td></tr>`; }
      const ed = S.quick[c.key] || {};
      out += `<tr class="${S.quick[c.key] ? 'edited' : ''}"><td class="num muted">${c.n}</td>${QF.map(([f, label, rtl]) => {
        if (f === 'price' && c.noprice) return '<td class="muted" style="font-size:12.5px">Badge only</td>';
        const v = f in ed ? ed[f] : origOf(c, f);
        const unit = f === 'price' ? (c.lbp ? 'L.L' : '$') : f === 'saving' && c.save_txt == null ? '%' : '';
        return `<td class="q-${f}"><span class="qwrap"><input class="input qin ${f in ed ? 'changed' : ''}" data-key="${esc(c.key)}" data-f="${f}" value="${esc(v)}"
          ${rtl ? 'dir="rtl"' : ''} ${f === 'price' ? 'inputmode="decimal"' : ''} aria-label="${esc(label)} for ${esc(c.en || c.ar)}"
          title="${f === 'price' && c.lbp ? 'L.L.: dots are thousands, e.g. 550.000' : f === 'saving' && c.save_txt == null ? 'Whole number 10–90, empty for no badge' : esc(label)}">${unit ? `<i>${unit}</i>` : ''}</span>
          ${f === 'en' ? `<div class="codes num">${esc(c.key)}</div>` : ''}</td>`;
      }).join('')}</tr>`;
    }
    body.innerHTML = `<div class="quick-tools"><input class="input" id="quick-filter" placeholder="Find a card (name, code, section)" value="${esc(S.qfilter)}" aria-label="Find a card">
        <span class="muted" style="font-size:13px">Layout, photos and anything else: pin it on the page and use Send edits (the agent).</span></div>
      <div class="cards-wrap"><table class="cards quick-table"><thead><tr><th>#</th>${QF.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${out || '<tr><td colspan="7" class="muted">No card matches.</td></tr>'}</tbody></table></div>
      <div class="quick-bar"><span id="quick-count"></span><button class="btn btn-sm btn-ghost" id="quick-reset">Undo all</button><button class="btn btn-sm btn-primary" id="quick-apply">Apply quick edits</button></div>`;
    updateQuickBar();
  }

  function updateQuickBar() {
    const n = quickCount();
    const cnt = $('#quick-count', root); if (cnt) cnt.textContent = n ? `${n} card${n > 1 ? 's' : ''} changed` : 'No changes yet';
    const ap = $('#quick-apply', root); if (ap) ap.disabled = !n;
    const rs = $('#quick-reset', root); if (rs) rs.disabled = !n;
  }

  function onQuickInput(inp) {
    const c = S.qcards?.find((x) => x.key === inp.dataset.key);
    if (!c) return;
    const f = inp.dataset.f;
    const ed = { ...(S.quick[c.key] || {}) };
    if (inp.value.trim() === origOf(c, f)) delete ed[f]; else ed[f] = inp.value;
    if (Object.keys(ed).length) S.quick[c.key] = ed; else delete S.quick[c.key];
    inp.classList.toggle('changed', f in ed);
    inp.closest('tr').classList.toggle('edited', !!S.quick[c.key]);
    saveQuick();
    updateQuickBar();
  }

  async function applyQuick() {
    const changes = Object.entries(S.quick).map(([key, f]) => ({ key, ...f }));
    if (!changes.length) return;
    const btn = $('#quick-apply', root); if (btn) btn.disabled = true;
    try {
      job = await post(`/api/jobs/${job.id}/stages/flyer/quick`, { changes });
      S.quick = {}; saveQuick();
      toast(`Quick edit running: round ${job.quickRound}, about 15 s`);
      redraw();
    } catch (err) { toast(err.message, { error: true }); if (btn) btn.disabled = false; }
  }
  function saveQuick() { try { localStorage.setItem(`diwan-quick:${job.id}`, JSON.stringify(S.quick)); } catch { /* private mode */ } }

  async function drawFiles(el, rv, cmp) {
    const files = rv.files || [];
    const images = files.filter((f) => f.kind === 'image');
    const others = files.filter((f) => f.kind !== 'image').sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    let html = '';
    if (images.length) {
      const wide = images.some((f) => /\b16x9|\/s-\d|contact/.test(f.path));
      if (cmp) {
        const old = (cmp.files || []).filter((f) => f.kind === 'image');
        html += `<div class="fileblock"><div class="fileblock-head"><h3>Round ${cmp.round} ↔ round ${rv.round}</h3></div>
          <div class="compare">${[[cmp, old], [rv, images]].map(([r, list]) => `<div class="compare-col"><h3>Round ${r.round}</h3>
            <div class="gallery ${wide ? 'wide' : ''}">${list.map((f, i) => thumb(f, i, list, r.round === rv.round)).join('')}</div></div>`).join('')}</div></div>`;
      } else {
        const unit = ['social', 'video'].includes(S.stage) ? 'slide' : 'page';
        html += `<div class="fileblock"><div class="fileblock-head"><h3>${images.length > 1 ? `${images.length} ${unit}s` : esc(images[0].label || 'Image')}</h3>
          ${canPin() ? `<span class="muted" style="font-size:13px">Open a ${unit} and click to pin a comment.</span>` : ''}</div>
          <div class="gallery ${wide ? 'wide' : ''}" id="gal">${images.map((f, i) => thumb(f, i, images, true)).join('')}</div></div>`;
      }
    }
    for (const f of others) {
      const url = fileUrl(job.id, f.path);
      const label = esc(f.label || f.path.split('/').pop());
      if (f.kind === 'pdf') html += `<div class="fileblock"><div class="fileblock-head"><h3>${label}</h3><a class="btn btn-sm" href="${url}" target="_blank" rel="noopener">Open PDF</a></div><iframe class="viewer" src="${url}" title="${label}" loading="lazy"></iframe></div>`;
      else if (f.kind === 'html') {
        const phone = /mobile/i.test(f.path + f.label);
        html += `<div class="fileblock"><div class="fileblock-head"><h3>${label}</h3><a class="btn btn-sm" href="${url}" target="_blank" rel="noopener">Open in a tab</a></div>
          ${phone ? `<div class="phone"><iframe src="${url}" title="${label}" loading="lazy"></iframe></div>` : `<iframe class="viewer" src="${url}" title="${label}" loading="lazy"></iframe>`}</div>`;
      } else if (f.kind === 'video') html += `<div class="fileblock"><div class="fileblock-head"><h3>${label}</h3><a class="btn btn-sm" href="${url}" download>Download</a></div><video class="video" src="${url}#t=0.5" controls preload="metadata"></video></div>`;
      else if (f.kind === 'text') html += `<div class="fileblock"><div class="fileblock-head"><h3>${label}</h3><button class="btn btn-sm" data-copy="${esc(f.path)}">Copy</button></div><pre class="textfile" data-text="${esc(f.path)}">Loading…</pre></div>`;
      else if (f.kind === 'table') html += `<div class="fileblock"><div class="fileblock-head"><h3>${label}</h3><span class="muted" style="font-size:13px" id="cards-count"></span></div><div class="cards-wrap" data-table="${esc(f.path)}">Loading…</div></div>`;
      else html += `<div class="fileblock"><a class="btn" href="${url}" download>${label}</a></div>`;
    }
    el.innerHTML = html;
    for (const pre of $$('[data-text]', el)) {
      const t = await fetch(fileUrl(job.id, pre.dataset.text)).then((r) => r.text()).catch(() => '');
      pre._raw = t;
      // one block per line, each with its own direction: Arabic lines RTL in Madani, English lines LTR
      pre.innerHTML = t.replace(/\n+$/, '').split('\n').map((line) => {
        const ar = /^[^A-Za-z]*[؀-ۿ]/.test(line);
        return `<div dir="${ar ? 'rtl' : 'ltr'}" class="${ar ? 'ar' : 'ltr-line'}">${esc(line) || '&nbsp;'}</div>`;
      }).join('');
    }
    for (const box of $$('[data-table]', el)) {
      box.dataset.rows = '';
      const rows = await fetch(fileUrl(job.id, box.dataset.table)).then((r) => r.json()).catch(() => null);
      box._rows = Array.isArray(rows) ? rows : [];
      drawCards(box);
    }
  }

  function canPin() { return canEdit() && S.compare == null && (!S.round || S.round === finishedRounds().at(-1)?.n); }

  function thumb(f, i, list, current) {
    const url = fileUrl(job.id, f.path);
    const pins = current ? pinsFor(f.path) : [];
    return `<button class="thumb" data-thumb="${i}" data-current="${current ? 1 : 0}" data-list="${current ? 'cur' : 'cmp'}">
      <span class="thumb-img"><img src="${url}" alt="${esc(f.label || '')}" loading="lazy" data-nat>
        ${pins.map((p) => `<span class="pin" data-x="${p.x}" data-y="${p.y}">${p.n}</span>`).join('')}</span>
      <span class="thumb-label">${esc(f.label || f.path.split('/').pop())}</span></button>`;
  }

  function placeThumbPins() {
    for (const img of $$('.thumb-img img', root)) {
      const go = () => {
        const k = img.clientWidth / (img.naturalWidth || img.clientWidth || 1);
        img.parentElement.querySelectorAll('.pin').forEach((p) => { p.style.left = `${p.dataset.x * k}px`; p.style.top = `${p.dataset.y * k}px`; });
      };
      img.complete ? go() : img.addEventListener('load', go, { once: true });
    }
  }

  function pinsFor(path) {
    return pending().map((e, i) => ({ ...e, n: i + 1 })).filter((e) => e.kind === 'pin' && e.file === path);
  }

  function drawCards(box) {
    const rows = box._rows;
    const edited = new Set(pending().filter((e) => e.kind === 'card').map((e) => e.card));
    const editable = canEdit();
    let sec = null, out = '';
    for (const r of rows) {
      if (r.section !== sec) { sec = r.section; out += `<tr class="sec"><td colspan="7">${txt(r.section_ar || r.section)} <span class="muted" style="font-weight:500">· ${esc(r.section)}</span></td></tr>`; }
      const key = r.ar || r.en;
      out += `<tr class="${edited.has(key) ? 'edited' : ''}">
        <td class="num muted">${esc(r.n)}</td>
        <td class="ar" dir="rtl">${esc(r.ar)}</td>
        <td>${esc(r.en)}<div class="codes num">${esc((r.codes || []).join(' '))}</div></td>
        <td>${txt(r.unit)}</td>
        <td class="price num ${r.price == null ? 'missing' : ''}">${r.price == null ? 'missing' : r.currency === 'L.L' ? `${Math.round(r.price).toLocaleString('en-US').replace(/,/g, '.')}L.L` : `${(+r.price).toFixed(2)}$`}</td>
        <td class="num">${esc(r.saving || '')}</td>
        <td>${editable ? (S.editingCard === key
          ? `<form class="row-edit" data-card="${esc(key)}"><input class="input" placeholder="What should change?" aria-label="Edit for ${esc(key)}"><button class="btn btn-sm btn-mark">Add</button></form>`
          : `<button class="btn btn-sm btn-ghost" data-edit-card="${esc(key)}">Edit</button>`) : ''}</td></tr>`;
    }
    box.innerHTML = `<table class="cards"><thead><tr><th>#</th><th>Arabic</th><th>English</th><th>Unit</th><th>Price</th><th>Saving</th><th></th></tr></thead><tbody>${out}</tbody></table>`;
    const cnt = $('#cards-count', root); if (cnt) cnt.textContent = `${rows.length} cards`;
    $('.row-edit input', box)?.focus();
  }

  // ---------- rail
  function drawRail() {
    readDraft(); readPhotoForm(); // keep what's typed in the forms across redraws (live updates redraw the rail)
    const s = st(), el = $('#rail', root), dec = $('#decide', root);
    const def = sdef(S.stage);
    const last = s.rounds.at(-1);
    let top = '';
    if (s.status === 'running' || s.status === 'editing') {
      const quick = last?.kind === 'quick';
      top = `<div class="state-box running"><b>${quick ? `Studio re-rendering the flyer: round ${last.n}, quick edit, no agent` : s.status === 'running' ? `Agent working on round ${last?.n}` : 'Edits queued'}</b>
        ${job.queuePosition > 1 ? `<div>Waiting behind ${job.queuePosition - 1} other week${job.queuePosition > 2 ? 's' : ''}.</div>` : ''}
        ${last?.edits?.length ? `<ul style="margin:8px 0 0;padding-left:18px">${last.edits.map((e) => `<li>${e.kind === 'photo' && e.card ? `${txt(e.card)}: ` : ''}${txt(e.text)}${attThumbs(e.images)}</li>`).join('')}</ul>` : ''}
        ${quick ? `<ul style="margin:8px 0 0;padding-left:18px">${(last.quick || []).map((q) => `<li>${txt(q.desc)}</li>`).join('')}</ul>` : ''}</div>`;
    } else if (s.status === 'failed') {
      top = `<div class="state-box failed"><b>Round ${last?.n} failed</b><div>${esc(s.error)}</div>${s.lastLog?.length ? `<pre>${esc(s.lastLog.join('\n'))}</pre>` : ''}</div>`;
    } else if (s.status === 'approved') {
      top = `<div class="state-box done"><b>Approved</b> · round ${last?.n}${last?.approvedAt ? `, ${new Date(last.approvedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.
        ${S.stage !== 'delivery' ? '<div style="margin-top:6px">Need a change? Add edits below and reopen. Later stages that use it will rebuild.</div>' : ''}</div>`;
    } else if (s.status === 'skipped' || s.status === 'pending') {
      top = `<div class="state-box" style="background:var(--panel-2)">${s.status === 'skipped' ? 'Skipped this week.' : 'Not started yet.'}</div>`;
    }
    if (s.rerun) top += `<div class="state-box running">Rebuild queued: ${esc(s.rerunReason || 'cards changed')}.</div>`;

    const qs = job.questions.filter((q) => q.stage === S.stage);
    const answering = new Set(pending().filter((e) => e.kind === 'answer').map((e) => e.qid));
    const questions = qs.length ? `<h2>Questions</h2><div class="questions">${qs.map((q) => {
      const done = q.answer != null;
      return `<div class="q ${q.blocking && !done ? 'blocking' : ''} ${done ? 'done' : ''}">
        ${q.blocking && !done ? '<div class="q-flag">Blocks the work</div>' : ''}
        <p class="q-text">${txt(q.text)}</p>
        ${done ? `<div>Answered: ${txt(q.answer)}</div>` : answering.has(q.id) ? '<div class="muted">Answer added to your edits.</div>'
          : canEdit() ? `<form class="row-edit" data-answer="${esc(q.id)}"><input class="input" placeholder="Your answer" aria-label="Answer"><button class="btn btn-sm">Add</button></form>` : ''}
      </div>`;
    }).join('')}</div>` : '';

    const pf = S.photoForm;
    const edits = canEdit() ? `<h2>Your edits <span class="muted" style="font-size:13px;font-weight:500">${pending().length || ''}</span></h2>
      ${pending().length ? `<ol class="edit-list">${pending().map((e, i) => `<li class="edit">
        <span class="edit-tag k-${e.kind}">${e.kind === 'pin' ? `${i + 1} · p${e.page}` : esc(tagText(e))}</span>
        <span class="edit-text">${['card', 'photo'].includes(e.kind) && e.card ? `<span style="display:block">${txt(e.card)}</span>` : ''}${txt(e.text)}${attThumbs(e.images, i)}</span>
        <button class="edit-x" data-rm="${i}" aria-label="Remove edit">×</button>
        <div class="edit-foot">
          ${e.kind === 'photo' ? '' : `<label class="edit-std"><input type="checkbox" data-std="${i}" ${e.standing ? 'checked' : ''}> Standing rule for every week</label>`}
          ${(e.images?.length || 0) < 8 ? `<button type="button" class="att-add" data-attach="${i}">${CLIP} Image</button>` : ''}
        </div>
      </li>`).join('')}</ol>` : '<p class="muted" style="font-size:14px;margin:0 0 12px">No edits yet. Pin comments on the pages, edit a card, or write a note. Paste or drop images anywhere here.</p>'}
      ${pf ? `<form class="add-note photo-form drop-zone" id="photo-form">
        <h3>Missing item photo</h3>
        <label>Item, as on the card<input class="input" name="card" dir="auto" value="${esc(pf.card)}" placeholder="هاربيك" aria-label="Item as on the card"></label>
        <label>Brand, product and size (English)<input class="input" name="text" value="${esc(pf.text)}" placeholder="Harpic Toilet Cleaner 750 ml" aria-label="Brand, product and size"></label>
        ${pf.images.length ? attDraft(pf.images, 'photo') : '<p class="drop-hint">Drop the photo here, paste it (Ctrl+V), or choose it.</p>'}
        <div class="add-row"><button type="button" class="btn btn-sm btn-ghost" data-attach="photo">${CLIP} Choose photo</button><span class="grow"></span>
          <button type="button" class="btn btn-sm btn-ghost" data-photo-cancel>Cancel</button><button class="btn btn-sm btn-primary">Add photo</button></div>
        <p class="drop-hint">A clean pack shot on white works best. The agent cuts it out and suggests where it goes in the photo library.</p>
      </form>` : ''}
      <form class="add-note drop-zone" id="add-note"><textarea class="input" placeholder="General note for the agent. Paste or drop images here." aria-label="General note">${esc(S.draftText || '')}</textarea>
        ${S.draftImages.length ? attDraft(S.draftImages, 'draft') : ''}
        <div class="add-row"><button type="button" class="btn btn-sm btn-ghost" data-attach="draft">${CLIP} Attach image</button>
          ${pf ? '' : '<button type="button" class="btn btn-sm btn-ghost" data-photo-form>+ Missing item photo</button>'}<span class="grow"></span>
          <button class="btn btn-sm">Add note</button></div></form>` : '';

    el.innerHTML = top + questions + edits;

    // decision buttons
    const n = pending().length;
    const blocking = qs.filter((q) => q.blocking && q.answer == null && !answering.has(q.id)).length;
    if (s.status === 'awaiting_review') {
      dec.innerHTML = `<button class="btn btn-mark" id="send" ${n ? '' : 'disabled'}>Send edits <span class="count">${n}</span></button>
        <button class="btn btn-approve" id="approve">Approve ${esc(def.label.toLowerCase())}</button>
        <p class="decide-hint">${blocking ? `${blocking} blocking question${blocking > 1 ? 's' : ''} still open.` : n ? 'Send edits for another round, or approve as is.' : 'Approving moves on to the next stage.'}</p>`;
    } else if (s.status === 'approved' && S.stage !== 'delivery') {
      dec.innerHTML = `<button class="btn btn-mark" id="reopen" ${n ? '' : 'disabled'}>Reopen with edits <span class="count">${n}</span></button>`;
    } else if (s.status === 'failed') {
      dec.innerHTML = '<button class="btn btn-primary" id="retry">Retry this stage</button>';
    } else if (s.status === 'running' || s.status === 'editing') {
      dec.innerHTML = '<button class="btn" id="cancel">Cancel run</button>';
    } else if (job.state === 'done') {
      dec.innerHTML = '<p class="decide-hint">Delivered. Every stage is approved.</p>';
    } else dec.innerHTML = '';
    dec.hidden = !dec.innerHTML;
  }

  // ---------- log
  function logLine(l) {
    const type = ['tool', 'text', 'app', 'error', 'prompt', 'system', 'result'].includes(l.type) ? l.type : 'text';
    return `<div class="ln ${type}"><time>${clock(l.t)}</time><span class="tx">${type === 'text' ? txt(l.text) : esc(l.text)}</span></div>`;
  }
  function drawLog() {
    const body = $('#log-body', root);
    body.innerHTML = S.log.slice(-300).map(logLine).join('');
    body.scrollTop = body.scrollHeight;
  }

  // ---------- pending edits (saved on the server so they survive a refresh)
  const savePending = debounce(() => api('PUT', `/api/jobs/${job.id}/stages/${S.stage}/pending`, { edits: pending() }).catch((e) => toast(e.message, { error: true })), 300);
  function setPending(list) {
    readDraft(); readPhotoForm();
    st().pendingEdits = list;
    savePending();
    drawRail();
    refreshPins();
    drawPhotos();
    const box = $('[data-table]', root); if (box?._rows) drawCards(box);
  }
  function refreshPins() {
    for (const t of $$('.thumb[data-current="1"]', root)) {
      const list = imagesOfCurrent();
      const f = list[+t.dataset.thumb];
      const holder = $('.thumb-img', t);
      holder.querySelectorAll('.pin').forEach((p) => p.remove());
      holder.insertAdjacentHTML('beforeend', pinsFor(f.path).map((p) => `<span class="pin" data-x="${p.x}" data-y="${p.y}">${p.n}</span>`).join(''));
    }
    placeThumbPins();
  }
  function imagesOfCurrent() {
    const rv = S.reviews[`${S.stage}:${viewedRound()}`];
    return (rv?.files || []).filter((f) => f.kind === 'image');
  }

  // ---------- events
  root.addEventListener('click', async (e) => {
    const t = e.target;
    const rb = t.closest('[data-round]');
    if (rb) { S.round = +rb.dataset.round; S.compare = null; return drawProof().then(placeThumbPins); }
    if (t.closest('[data-compare]')) {
      const rounds = finishedRounds();
      if (S.compare) S.compare = null;
      else { const cur = viewedRound(); S.compare = rounds.filter((r) => r.n < cur).at(-1)?.n || rounds[0].n; S.round = cur; }
      return drawProof().then(placeThumbPins);
    }
    const th = t.closest('.thumb');
    if (th) {
      const current = th.dataset.current === '1';
      const n = current ? viewedRound() : S.compare;
      const rv = S.reviews[`${S.stage}:${n}`];
      const list = (rv?.files || []).filter((f) => f.kind === 'image');
      openLightbox({
        items: list.map((f, i) => ({ src: fileUrl(job.id, f.path), label: `${f.label || ''}${current ? '' : ` (round ${n})`}`, path: f.path, page: i + 1 })),
        index: +th.dataset.thumb,
        pinnable: current && canPin(),
        pinsFor: current ? pinsFor : () => [],
        onPin: ({ path, page, x, y, text }) => setPending([...pending(), { kind: 'pin', file: path, page, x, y, text }]),
      });
      return;
    }
    const vi = t.closest('[data-view-img]');
    if (vi) {
      const group = $$('[data-view-img]', vi.closest('.att-thumbs, .lib-list') || vi.parentElement);
      openLightbox({ items: group.map((g) => ({ src: fileUrl(job.id, g.dataset.viewImg), label: g.title || g.dataset.viewImg.split('/').pop(), path: g.dataset.viewImg })), index: Math.max(0, group.indexOf(vi)), pinnable: false });
      return;
    }
    const at = t.closest('[data-attach]');
    if (at) { const v = at.dataset.attach; return pickFiles(v === 'draft' || v === 'photo' ? v : +v); }
    if (t.closest('[data-photo-form]')) return openPhotoForm();
    if (t.closest('[data-photo-cancel]')) { S.photoForm = null; readDraft(); return drawRail(); }
    const ms = t.closest('[data-missing]');
    if (ms) {
      const m = S.reviews[`${S.stage}:${viewedRound()}`]?.missing?.[+ms.dataset.missing];
      if (!m) return;
      openPhotoForm({ card: m.card || m.en, text: m.en || '' });
      return pickFiles('photo');
    }
    const ri = t.closest('[data-rm-img]');
    if (ri) {
      const [i, j] = ri.dataset.rmImg.split(':').map(Number);
      const l = pending().slice(); const imgs = (l[i].images || []).filter((_, k) => k !== j);
      if (l[i].kind === 'photo' && !imgs.length) { if (!confirm('This removes the photo edit. Remove it?')) return; l.splice(i, 1); }
      else l[i] = { ...l[i], images: imgs };
      return setPending(l);
    }
    const rd = t.closest('[data-rm-draft]');
    if (rd) {
      const [where, j] = rd.dataset.rmDraft.split(':');
      if (where === 'photo' && S.photoForm) { readPhotoForm(); S.photoForm.images.splice(+j, 1); } else { readDraft(); S.draftImages.splice(+j, 1); }
      return drawRail();
    }
    const ls = t.closest('[data-lib-save]');
    if (ls) return saveToLibrary(+ls.dataset.libSave);
    const lu = t.closest('[data-lib-undo]');
    if (lu) {
      const target = lu.dataset.libUndo;
      if (!confirm(`Take "${target}" out of the photo library? It's moved to data/trash/library, not deleted.`)) return;
      try { job = await post(`/api/jobs/${job.id}/library/undo`, { target }); toast('Removed from the photo library'); drawPhotos(); }
      catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const ec = t.closest('[data-edit-card]');
    if (ec) { S.editingCard = ec.dataset.editCard; const box = $('[data-table]', root); drawCards(box); return; }
    const rm = t.closest('[data-rm]');
    if (rm) { const l = pending().slice(); l.splice(+rm.dataset.rm, 1); return setPending(l); }
    const cp = t.closest('[data-copy]');
    if (cp) { const pre = $(`[data-text="${CSS.escape(cp.dataset.copy)}"]`, root); await navigator.clipboard.writeText(pre._raw ?? pre.textContent); return toast('Caption copied'); }
    if (t.id === 'send' || t.closest('#send')) return act('edits', { edits: pending() }, 'Edits sent. The agent is on it.');
    if (t.id === 'reopen' || t.closest('#reopen')) return act('reopen', { edits: pending() }, 'Reopened. Later stages will rebuild.');
    if (t.id === 'approve') {
      const n = pending().length;
      const open = job.questions.filter((q) => q.stage === S.stage && q.blocking && q.answer == null).length;
      if (n && !confirm(`You have ${n} unsent edit${n > 1 ? 's' : ''}. Approve anyway and drop them?`)) return;
      if (open && !confirm(`${open} blocking question${open > 1 ? 's are' : ' is'} unanswered. Approve anyway?`)) return;
      if (n) { st().pendingEdits = []; await api('PUT', `/api/jobs/${job.id}/stages/${S.stage}/pending`, { edits: [] }); }
      return act('approve', {}, `${sdef(S.stage).label} approved`);
    }
    if (t.id === 'quick-apply') return applyQuick();
    if (t.id === 'quick-reset') { S.quick = {}; saveQuick(); return drawQuickTable(); }
    if (t.id === 'retry') return act('retry', {}, 'Retrying');
    if (t.id === 'cancel') { await post(`/api/jobs/${job.id}/cancel`); return toast('Cancelling the run'); }
  });

  root.addEventListener('input', (e) => {
    if (e.target.classList.contains('qin')) return onQuickInput(e.target);
    if (e.target.dataset.libFolder != null) return libHint(e.target);
    if (e.target.dataset.libName != null) e.target.classList.remove('bad');
    if (e.target.id === 'quick-filter') {
      S.qfilter = e.target.value;
      drawQuickTable();
      const f = $('#quick-filter', root); f.focus(); f.setSelectionRange(f.value.length, f.value.length);
    }
  });
  root.addEventListener('toggle', (e) => {
    if (e.target.id !== 'quick-box') return;
    S.quickOpen = e.target.open;
    if (S.quickOpen && !$('#quick-body table', root)) loadQuickCards();
  }, true);

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'att-file') { const files = [...t.files]; t.value = ''; if (files.length) addImages(files); return; }
    const std = t.closest('[data-std]');
    if (std) { const l = pending().slice(); l[+std.dataset.std] = { ...l[+std.dataset.std], standing: std.checked }; setPending(l); }
    if (t.dataset.imgRole) {
      const [i, j] = t.dataset.imgRole.split(':').map(Number);
      const l = pending().slice(); const imgs = l[i].images.slice(); imgs[j] = { ...imgs[j], role: t.value };
      l[i] = { ...l[i], images: imgs }; setPending(l);
    }
    if (t.dataset.draftRole) S.draftImages[+t.dataset.draftRole].role = t.value;
  });

  // paste (Ctrl+V) and drop images anywhere in the edits rail or on the missing-photos list
  const imageFiles = (dt) => [...(dt?.files || [])].filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|heic)$/i.test(f.name));
  const targetFor = (el) => (el?.closest('#photo-form') ? 'photo' : el?.closest('.edit') ? +($('[data-attach]', el.closest('.edit'))?.dataset.attach ?? NaN) : null);
  // on the document: with nothing focused a paste goes to <body>, outside this view
  const onPaste = (e) => {
    const files = imageFiles(e.clipboardData);
    if (!files.length || !canEdit() || !$('#lightbox').hidden) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && !root.contains(el) && el !== document.body) return;
    e.preventDefault();
    const tg = targetFor(el);
    addImages(files, Number.isNaN(tg) ? null : tg);
  };
  document.addEventListener('paste', onPaste);
  root.addEventListener('dragover', (e) => {
    if (!canEdit() || ![...(e.dataTransfer?.types || [])].includes('Files') || !e.target.closest('.rail, #photos')) return;
    e.preventDefault();
    root.querySelector('.rail')?.classList.add('dropping');
    e.target.closest('.drop-zone, .edit')?.classList.add('drop-over');
  });
  root.addEventListener('dragleave', (e) => {
    e.target.closest?.('.drop-zone, .edit')?.classList.remove('drop-over');
    if (!e.relatedTarget || !root.querySelector('.rail')?.contains(e.relatedTarget)) root.querySelector('.rail')?.classList.remove('dropping');
  });
  root.addEventListener('drop', (e) => {
    const files = imageFiles(e.dataTransfer);
    root.querySelector('.rail')?.classList.remove('dropping');
    $$('.drop-over', root).forEach((x) => x.classList.remove('drop-over'));
    if (!files.length || !canEdit() || !e.target.closest('.rail, #photos')) return;
    e.preventDefault();
    const tg = targetFor(e.target);
    addImages(files, Number.isNaN(tg) ? null : tg);
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'photo-form') {
      readPhotoForm();
      const p = S.photoForm;
      if (!p.images.length) { toast('Add the photo first: drop it, paste it, or choose it.', { error: true }); return; }
      if (!p.card.trim() && !p.text.trim()) { toast('Say which item the photo is for.', { error: true }); return f.elements.card.focus(); }
      S.photoForm = null;
      return setPending([...pending(), { kind: 'photo', card: p.card.trim() || p.text.trim(), text: p.text.trim(), images: p.images }]);
    }
    const input = $('input, textarea', f);
    const text = input?.value.trim();
    if (f.id === 'add-note') {
      if (!text && !S.draftImages.length) return input?.focus();
      const images = S.draftImages; S.draftImages = []; S.draftText = ''; input.value = '';
      return setPending([...pending(), { kind: 'general', text, images }]);
    }
    if (!text) return input?.focus();
    if (f.dataset.answer) setPending([...pending(), { kind: 'answer', qid: f.dataset.answer, text }]);
    else if (f.dataset.card) { S.editingCard = null; setPending([...pending(), { kind: 'card', card: f.dataset.card, text }]); }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.closest('#add-note')) e.target.closest('form').requestSubmit();
    if (e.key === 'Escape' && S.editingCard) { S.editingCard = null; drawCards($('[data-table]', root)); }
  });

  async function act(what, body, msg) {
    try {
      job = await post(`/api/jobs/${job.id}/stages/${S.stage}/${what}`, body);
      toast(msg);
      if (what === 'approve' && job.current && job.current !== S.stage) { location.hash = `#/week/${job.id}/${job.current}`; return; }
      redraw();
    } catch (err) { toast(err.message, { error: true }); }
  }

  async function redraw() { drawRunsheet(); drawRail(); await drawProof(); placeThumbPins(); }

  // ---------- live
  let lastStatus = st().status;
  const close = listen(`/api/jobs/${job.id}/events`, {
    job: (j) => {
      const keep = st().pendingEdits;
      job = j;
      if (S.stage && job.stages[S.stage].status === 'awaiting_review' && keep && !job.stages[S.stage].pendingEdits?.length) job.stages[S.stage].pendingEdits = keep;
      const now = st().status;
      drawRunsheet(); drawRail();
      if (now !== lastStatus) { S.round = null; S.compare = null; drawProof().then(placeThumbPins); }
      lastStatus = now;
    },
    log: (l) => {
      S.log.push(l);
      const body = $('#log-body', root);
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
      body.insertAdjacentHTML('beforeend', logLine(l));
      if (atBottom) body.scrollTop = body.scrollHeight;
    },
    removed: () => { location.hash = '#/'; },
  });

  drawLog();
  if (['running', 'editing'].includes(st().status)) $('#log', root).open = true;
  await redraw();
  window.addEventListener('resize', placeThumbPins);
  return () => { close(); window.removeEventListener('resize', placeThumbPins); document.removeEventListener('paste', onPaste); };
}

function loadQuick(id) {
  try { return JSON.parse(localStorage.getItem(`diwan-quick:${id}`)) || {}; } catch { return {}; }
}

function lastActive(job) {
  const keys = Object.keys(job.stages);
  return keys.filter((k) => job.stages[k].status !== 'skipped').at(-1) || keys[0];
}
