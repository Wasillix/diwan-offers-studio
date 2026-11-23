// Notifications: Windows toast (WinRT through PowerShell, no extra install; clicking opens the Studio),
// the browser (forwarded to the Studio over SSE as a 'notify' event), and optionally Telegram
// (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env). Which events notify is set in Settings.
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as M from './machine.js';
import { stageDef } from './stages.js';
import { runPowerShell } from './powershell.js';

const xml = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
// Windows PowerShell's own AppUserModelID: toasts show under "Windows PowerShell" without registering an app.
const APP_ID = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';

/** The toast's XML (escaped; may hold Arabic). It reaches PowerShell in the TOAST_XML env var. */
export function toastXml({ title, body, url }) {
  return `<toast activationType="protocol" launch="${xml(url)}" duration="long"><visual><binding template="ToastGeneric">`
    + `<text>${xml(title)}</text><text>${xml(body)}</text><text placement="attribution">Diwan Offers Studio</text></binding></visual>`
    + `<actions><action content="Open" activationType="protocol" arguments="${xml(url)}"/></actions></toast>`;
}

/** Fixed, ASCII, one statement per line (see powershell.js). */
export const TOAST_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
  '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null',
  '$x = New-Object Windows.Data.Xml.Dom.XmlDocument',
  '$x.LoadXml($env:TOAST_XML)',
  `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${APP_ID}').Show((New-Object Windows.UI.Notifications.ToastNotification $x))`,
].join('\n');

export class Notifier extends EventEmitter {
  constructor({ config, settings, spawnImpl = spawn, fetchImpl = globalThis.fetch }) {
    super();
    Object.assign(this, { config, settings, spawnImpl, fetchImpl });
    this.sent = []; // last few, for the Settings screen
  }

  telegramConfigured() { return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID); }

  /** { kind, title, body, jobId?, url? } — url is a Studio hash route like "#/week/<id>". */
  async send(n, { force = false } = {}) {
    const s = this.settings.get().notifications;
    if (!force && s.on[n.kind] === false) return { skipped: true };
    const url = `http://localhost:${this.config.port}/${n.url || ''}`;
    const out = { kind: n.kind, title: n.title, body: n.body, url, t: new Date().toISOString(), channels: [] };
    if (s.browser) { this.emit('notify', out); out.channels.push('browser'); }
    if (s.toast && process.platform === 'win32') {
      try { await this.toast({ ...n, url }); out.channels.push('toast'); } catch (e) { out.toastError = e.message; }
    }
    if (s.telegram && this.telegramConfigured()) {
      try { await this.telegram(`${n.title}\n${n.body}`); out.channels.push('telegram'); } catch (e) { out.telegramError = e.message; }
    }
    this.sent.unshift(out); this.sent.length = Math.min(this.sent.length, 20);
    return out;
  }

  async toast({ title, body, url }) {
    const r = await runPowerShell(TOAST_SCRIPT, { env: { TOAST_XML: toastXml({ title, body, url }) }, timeoutMs: 30_000, spawnImpl: this.spawnImpl });
    // with -Command - a failed line doesn't change the exit code, so stderr is the signal
    if (r.timedOut || r.code !== 0 || r.err.trim()) throw new Error(r.err.trim().split('\n')[0] || `powershell exited ${r.code}`);
  }

  async telegram(text) {
    const res = await this.fetchImpl(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`Telegram said ${res.status}`);
  }
}

/** Notify when a week changes state: ready for review, blocking question, failed, delivered. */
export function watchTransitions({ runner, store, notifier }) {
  const last = new Map(store.list().map((j) => [j.id, M.jobStatus(j)]));
  runner.on('job', (job) => {
    const now = M.jobStatus(job), before = last.get(job.id);
    last.set(job.id, now);
    if (before === undefined || before === now) return;
    const cur = M.currentStage(job);
    const label = stageDef(cur || 'delivery')?.label || cur;
    const round = cur ? job.stages[cur].rounds.at(-1)?.n : null;
    const name = `${job.offer_name} ${job.dates_en}`.trim();
    const msg = {
      awaiting_review: { kind: 'review', title: `${label} ready for review`, body: `${name}${round > 1 ? ` · round ${round}` : ''}` },
      question: { kind: 'question', title: `${label}: the agent has a question`, body: `${name}. It needs an answer before the work can go on.` },
      failed: { kind: 'failed', title: `${label} failed`, body: `${name}. ${job.stages[cur]?.error || ''}`.trim() },
      done: { kind: 'done', title: 'Week delivered', body: `${name}. Every file is in Claude outputs\\${job.tag}.` },
    }[now];
    if (msg) notifier.send({ ...msg, jobId: job.id, url: `#/week/${job.id}${cur ? `/${cur}` : ''}` });
  });
}
