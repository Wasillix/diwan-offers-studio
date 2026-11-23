// First-run Setup (#/setup): pick the folders on this PC (photo library first), check the Claude sign-in.
// Shown on its own until Finish is clicked once; Settings → Folders → "Run setup again" brings it back.
import { $, $$, esc, get, post, toast } from '../lib.js';

const FOLDERS = [
  ['imageLibrary', 'Product photo library', 'The isolated product photos, by category (on Loaf Media\'s PC: 005 - FMCG Items\\001 - Isolated Items). The agent picks photos from here, and you can file new ones into it from a week.'],
  ['logos', 'Diwan logos', 'Business Units Logo folder with the white Diwan logo.'],
  ['inbox', 'Offers Inbox', 'Drop a week\'s offer sheet here and a draft week appears. Made for you if it doesn\'t exist.'],
  ['outputs', 'Claude outputs', 'Finished files for each week go in a folder here. Made for you if it doesn\'t exist.'],
];

export async function setupView(root) {
  let v = await get('/api/setup');
  const paths = { ...v.paths };
  const stats = {};

  const ok = (b) => `<span class="ok-dot ${b ? 'yes' : 'no'}" aria-label="${b ? 'OK' : 'Problem'}"></span>`;
  const statLine = (k) => {
    const s = stats[k];
    if (!paths[k]) return '<small class="muted">Not set</small>';
    if (!s) return '<small class="muted">Checking…</small>';
    if (!s.exists) return `<small class="warn-txt">${['inbox', 'outputs'].includes(k) ? 'Not there yet: it will be created.' : 'This folder isn\'t there.'}</small>`;
    if (k === 'imageLibrary') return `<small class="${s.images ? 'ok-txt' : 'warn-txt'}">${s.images ? `${s.images.toLocaleString('en-US')} photos in ${s.folders} folders` : 'No photos found in this folder. Is it the right one?'}</small>`;
    if (k === 'logos') return `<small class="${s.images ? 'ok-txt' : 'warn-txt'}">${s.images ? `${s.images} logo files` : 'No PNG, JPG or WebP files here.'}</small>`;
    return '<small class="ok-txt">Found</small>';
  };
  const folderOk = (k) => (['inbox', 'outputs'].includes(k) ? !!paths[k] : !!stats[k]?.exists && (k !== 'imageLibrary' || stats[k].images > 0));

  function draw() {
    root.innerHTML = `<section class="page setup">
      <div class="page-head"><div><h1>Set up the Studio on this PC</h1>
        <p class="lede">Pick the folders this PC uses. You can change them later in Settings → Folders.</p></div></div>
      <div class="panel">
        <h2>Folders</h2>
        ${FOLDERS.map(([k, label, note]) => `<div class="field setup-field" data-row="${k}">
          <label for="su-${k}">${ok(folderOk(k))} ${esc(label)}</label>
          <div class="pick-row"><input class="input" id="su-${k}" data-path="${k}" value="${esc(paths[k] || '')}" spellcheck="false" placeholder="D:\\…">
            <button class="btn" data-browse="${k}" ${v.windows ? '' : 'disabled title="Only on Windows"'}>Browse…</button></div>
          <div class="pick-stat" data-stat="${k}">${statLine(k)}</div>
          <small class="muted">${esc(note)}</small></div>`).join('')}
      </div>
      <div class="panel">
        <h2>Claude sign-in</h2>
        <div class="kv"><span>${ok(v.auth.ok)} Agent sign-in</span><span>${esc(v.auth.method)}</span></div>
        ${v.auth.hint ? `<p class="set-note">${esc(v.auth.hint)} The Studio works without it; the agent can't run until you sign in.</p>` : ''}
      </div>
      <div class="setup-foot">
        ${v.done ? '<a class="btn btn-ghost" href="#/settings">Back to Settings</a>' : '<button class="btn btn-ghost" data-act="later">Later</button>'}
        <button class="btn btn-primary" data-act="finish">Finish setup</button>
      </div>
    </section>`;
  }

  const redrawRow = (k) => {
    const st = $(`[data-stat="${k}"]`, root); if (st) st.innerHTML = statLine(k);
    const lab = $(`[data-row="${k}"] .ok-dot`, root); if (lab) lab.outerHTML = ok(folderOk(k));
  };
  async function check(k) {
    stats[k] = null; redrawRow(k);
    stats[k] = paths[k] ? await post('/api/system/folder-check', { path: paths[k] }).catch(() => ({ exists: false })) : { exists: false };
    redrawRow(k);
  }

  root.addEventListener('change', (e) => {
    const k = e.target.dataset.path;
    if (!k) return;
    paths[k] = e.target.value.trim().replace(/^"|"$/g, '');
    check(k);
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-browse]');
    if (b) {
      const k = b.dataset.browse;
      b.disabled = true; b.textContent = 'Picking…';
      try {
        const r = await post('/api/system/pick-folder', { initial: paths[k], title: `Choose the ${FOLDERS.find((f) => f[0] === k)[1]} folder` });
        if (r.path) { paths[k] = r.path; $(`[data-path="${k}"]`, root).value = r.path; check(k); }
      } catch (err) { toast(err.message, { error: true }); }
      b.disabled = false; b.textContent = 'Browse…';
      return;
    }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'later') { sessionStorage.setItem('diwan-setup-later', '1'); location.hash = '#/'; }
    if (a === 'finish') {
      for (const inp of $$('[data-path]', root)) paths[inp.dataset.path] = inp.value.trim().replace(/^"|"$/g, '');
      try {
        v = await post('/api/setup', { paths });
        toast('Setup saved');
        location.hash = '#/';
      } catch (err) { toast(err.message, { error: true }); }
    }
  });

  draw();
  await Promise.all(FOLDERS.map(([k]) => check(k)));
}
