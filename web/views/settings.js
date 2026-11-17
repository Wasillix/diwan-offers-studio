// Settings: weekly reminder, Offers Inbox, notifications, new-week defaults, agent, folders,
// Start with Windows, system checks. Every change saves straight away.
import { $, $$, esc, api, get, post, getMeta, toast, ago } from '../lib.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EVENTS = [
  ['review', 'A stage is ready for review'], ['question', 'The agent has a blocking question'], ['failed', 'A stage failed'],
  ['done', 'A week is delivered'], ['inbox', 'A new sheet lands in the Offers Inbox'], ['reminder', 'The weekly reminder'],
];
const EFFORTS = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High (recommended)'], ['xhigh', 'Extra high'], ['max', 'Max']];

export async function settingsView(root) {
  const meta = await getMeta();
  let v = await get('/api/settings');
  let checks = null;

  const ok = (b) => `<span class="ok-dot ${b ? 'yes' : 'no'}" aria-label="${b ? 'OK' : 'Problem'}"></span>`;

  function draw() {
    const s = v.settings;
    root.innerHTML = `<section class="page settings">
      <div class="page-head"><div><h1>Settings</h1><p class="lede">Changes save as you make them.</p></div></div>

      <div class="panel" id="sec-reminder">
        <div class="set-head"><h2>Weekly reminder</h2>
          <label class="switch"><input type="checkbox" data-k="schedule.enabled" ${s.schedule.enabled ? 'checked' : ''}><span>On</span></label></div>
        <p class="set-note">Creates a draft week for the coming Friday to Monday and reminds you to drop Diwan's sheet.</p>
        <div class="row3">
          <div class="field"><label for="s-day">Day</label><select class="input" id="s-day" data-k="schedule.weekday" data-num>${DAYS.map((d, i) => `<option value="${i}" ${i === s.schedule.weekday ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div class="field"><label for="s-time">Time</label><input class="input num" type="time" id="s-time" data-k="schedule.time" value="${esc(s.schedule.time)}"></div>
          <div class="field"><label for="s-tz">Time zone</label><input class="input" id="s-tz" data-k="schedule.timeZone" value="${esc(s.schedule.timeZone)}"></div>
        </div>
        <label class="check"><input type="checkbox" data-k="schedule.createDraft" ${s.schedule.createDraft ? 'checked' : ''}> Create the draft week, not just the reminder</label>
        <div class="set-foot"><span class="muted">${v.nextReminder ? `Next: ${esc(v.nextReminder)}` : 'Off'}${s.schedule.lastFired ? ` · last ran ${esc(s.schedule.lastFired)}` : ''}</span>
          <button class="btn btn-sm" data-act="run-reminder">Run it now</button></div>
      </div>

      <div class="panel">
        <div class="set-head"><h2>Offers Inbox</h2>
          <label class="switch"><input type="checkbox" data-k="inbox.enabled" ${s.inbox.enabled ? 'checked' : ''}><span>Watching</span></label></div>
        <p class="set-note">Drop an offer sheet (.xlsx) in <b class="path">${esc(s.paths.inbox)}</b> and a draft week appears, with the name and dates read from the file name. Intake starts only when you confirm the draft. Files in the folder are never moved or changed.</p>
        <div class="set-foot"><span class="muted">Name files like <span class="num">Weekend Offers 20-23 Nov.xlsx</span></span><button class="btn btn-sm" data-act="scan-inbox">Check the inbox now</button></div>
      </div>

      <div class="panel">
        <h2>Notifications</h2>
        <div class="checks checks-1">
          <label class="check"><input type="checkbox" data-k="notifications.toast" ${s.notifications.toast ? 'checked' : ''}> Windows notification (click it to open the week)</label>
          <label class="check"><input type="checkbox" data-k="notifications.browser" ${s.notifications.browser ? 'checked' : ''}> Browser notification while the Studio is open
            <button class="btn btn-sm btn-ghost" data-act="browser-perm" ${typeof Notification === 'undefined' || Notification.permission === 'granted' ? 'hidden' : ''}>Allow in this browser</button></label>
          <label class="check"><input type="checkbox" data-k="notifications.telegram" ${s.notifications.telegram ? 'checked' : ''} ${v.telegramConfigured ? '' : 'disabled'}> Telegram message to your phone
            <span class="muted">${v.telegramConfigured ? '(bot set in .env)' : '(add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env, then restart)'}</span></label>
        </div>
        <h3 style="margin-top:16px">Notify me when</h3>
        <div class="checks">${EVENTS.map(([k, label]) => `<label class="check"><input type="checkbox" data-k="notifications.on.${k}" ${s.notifications.on[k] !== false ? 'checked' : ''}> ${label}</label>`).join('')}</div>
        <div class="set-foot"><span class="muted">${v.recentNotifications[0] ? `Last: ${esc(v.recentNotifications[0].title)}, ${ago(v.recentNotifications[0].t)} (${esc(v.recentNotifications[0].channels.join(', ') || 'no channel')})` : 'Nothing sent yet'}</span>
          <button class="btn btn-sm" data-act="test-notification">Send a test</button></div>
      </div>

      <div class="panel">
        <h2>New week defaults</h2>
        <div class="row2">
          <div class="field"><label for="s-name">Offer name</label><input class="input" id="s-name" data-k="newWeek.offerName" value="${esc(s.newWeek.offerName)}"></div>
          <div class="field"><label for="s-kar">Cover kicker (Arabic)</label><input class="input ar" dir="rtl" id="s-kar" data-k="newWeek.kickerAr" value="${esc(s.newWeek.kickerAr)}"></div>
        </div>
        <div class="field"><label for="s-look">Look</label><select class="input" id="s-look" data-k="newWeek.look">${meta.looks.map((l) => `<option value="${esc(l.key)}" ${l.key === s.newWeek.look ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select></div>
        <span class="legend">Deliverables</span>
        <div class="checks" id="s-deliv" style="margin:6px 0 14px">${meta.deliverables.map((d) => `<label class="check"><input type="checkbox" value="${esc(d.key)}" ${s.newWeek.deliverables.includes(d.key) ? 'checked' : ''}> ${esc(d.label)}</label>`).join('')}</div>
        <div class="field"><label for="s-tasks">Task list every week starts with (one per line)</label><textarea class="input" id="s-tasks" data-k="newWeek.tasks" data-lines rows="5">${esc(s.newWeek.tasks.join('\n'))}</textarea></div>
      </div>

      <div class="panel">
        <h2>Agent</h2>
        <div class="seg" role="radiogroup" aria-label="Agent mode">
          ${[['real', 'Real agent', 'Claude does the work. Uses your Claude plan or API key.'], ['mock', 'Mock agent', 'Canned sample results. Free, for trying the Studio.']].map(([k, t, d]) => `
            <label class="seg-opt ${s.agent.mode === k ? 'on' : ''}"><input type="radio" name="mode" value="${k}" data-k="agent.mode" ${s.agent.mode === k ? 'checked' : ''} ${v.agentModeForced ? 'disabled' : ''}><b>${t}</b><span>${d}</span></label>`).join('')}
        </div>
        ${v.agentModeForced ? '<p class="set-note">Started with <span class="num">npm run mock</span>, so the mock agent is fixed for this session.</p>' : ''}
        <div class="row3" style="margin-top:14px">
          <div class="field"><label for="s-model">Model</label><input class="input num" id="s-model" data-k="agent.model" value="${esc(s.agent.model)}"></div>
          <div class="field"><label for="s-effort">Effort</label><select class="input" id="s-effort" data-k="agent.effort">${EFFORTS.map(([k, l]) => `<option value="${k}" ${k === s.agent.effort ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label for="s-budget">Budget per run (USD)</label><input class="input num" type="number" min="1" max="200" step="1" id="s-budget" data-k="agent.maxBudgetUsd" data-num value="${esc(s.agent.maxBudgetUsd)}"></div>
        </div>
        <div class="kv"><span>Sign-in</span><span>${ok(v.auth.ok)} ${esc(v.auth.method)}${v.auth.lastRun ? ` · last run ${esc(ago(v.auth.lastRun.at))} on ${esc(v.auth.lastRun.model)}` : ''}</span></div>
        ${v.auth.hint ? `<p class="set-note">${esc(v.auth.hint)}</p>` : ''}
      </div>

      <div class="panel">
        <h2>Folders</h2>
        ${v.folders.map((f) => `<div class="field"><label for="s-p-${f.key}">${ok(f.ok)} ${esc(f.label)}</label>
          <input class="input" id="s-p-${f.key}" data-k="paths.${f.key}" value="${esc(f.path)}" ${f.key === 'toolkit' ? 'readonly' : ''}>
          ${f.ok ? '' : `<small style="color:var(--mark)">Not found.${f.key === 'inbox' ? ' It\'s created when the inbox watcher starts.' : ''}</small>`}</div>`).join('')}
      </div>

      <div class="panel">
        <div class="set-head"><h2>Start with Windows</h2>
          <label class="switch"><input type="checkbox" id="s-startup" ${v.startup.enabled ? 'checked' : ''} ${v.startup.supported ? '' : 'disabled'}><span>${v.startup.enabled ? 'On' : 'Off'}</span></label></div>
        <p class="set-note">Starts the Studio in the background when you sign in, so the inbox and the reminder keep working. Adds one small launcher to your Startup folder${v.startup.file ? ` (<span class="path">${esc(v.startup.file)}</span>)` : ''}; turning it off removes it.</p>
      </div>

      <div class="panel">
        <div class="set-head"><h2>System</h2><button class="btn btn-sm btn-ghost" data-act="refresh-checks">Check again</button></div>
        <div id="checks">${checks ? checksHtml(checks) : '<p class="muted">Checking…</p>'}</div>
      </div>
    </section>`;
  }

  const checksHtml = (list) => list.map((c) => `<div class="kv"><span>${ok(c.ok)} ${esc(c.label)}</span><span>${esc(c.detail)}</span></div>`).join('');

  async function save(patch, msg = 'Saved') {
    try { v = await api('PUT', '/api/settings', patch); toast(msg); draw(); } catch (e) { toast(e.message, { error: true }); draw(); }
  }
  const patchFor = (key, value) => key.split('.').reduceRight((acc, k) => ({ [k]: acc }), value);

  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 's-startup') {
      try { v.startup = await post('/api/settings/startup', { enabled: t.checked }); toast(t.checked ? 'The Studio will start with Windows' : 'Removed from startup'); draw(); }
      catch (err) { toast(err.message, { error: true }); }
      return;
    }
    if (t.closest('#s-deliv')) return save({ newWeek: { deliverables: $$('#s-deliv input:checked', root).map((c) => c.value) } });
    const k = t.dataset.k;
    if (!k) return;
    let val = t.type === 'checkbox' ? t.checked : t.value;
    if ('num' in t.dataset) val = +val;
    if ('lines' in t.dataset) val = val.split('\n').map((x) => x.trim()).filter(Boolean);
    if (k === 'agent.mode') return save(patchFor(k, val), val === 'mock' ? 'Mock agent on' : 'Real agent on');
    save(patchFor(k, val));
  });

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!a) return;
    try {
      if (a === 'test-notification') { const r = await post('/api/settings/test-notification'); toast(r.channels?.length ? `Sent: ${r.channels.join(', ')}` : 'No channel is on'); }
      if (a === 'scan-inbox') { const r = await post('/api/settings/scan-inbox'); toast(r.created.length ? `${r.created.length} new draft week${r.created.length > 1 ? 's' : ''}` : 'No new sheets in the inbox'); }
      if (a === 'run-reminder') { const r = await post('/api/settings/run-reminder'); toast(r.job ? `Draft ready for ${r.job.dates_en}` : 'Reminder sent'); }
      if (a === 'browser-perm') { await Notification.requestPermission(); }
      if (a === 'refresh-checks') { $('#checks', root).innerHTML = '<p class="muted">Checking…</p>'; checks = await get('/api/settings/checks?refresh=1'); $('#checks', root).innerHTML = checksHtml(checks); return; }
      v = await get('/api/settings'); draw();
    } catch (err) { toast(err.message, { error: true }); }
  });

  draw();
  checks = await get('/api/settings/checks').catch(() => []);
  const box = $('#checks', root); if (box) box.innerHTML = checksHtml(checks);
}
