// Offers Inbox watcher: a new .xlsx in D:\Diwan\Offers Inbox becomes a draft week with the sheet attached.
// Name and dates are guessed from the file name; intake only starts after Waseem confirms the draft.
// Files in the inbox are never moved or changed. data/inbox.json remembers which ones became weeks.
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { guessFromFileName } from './dates.js';
import { writeJsonAtomic } from './store.js';

const SHEET = /\.(xlsx|xlsm|xls|csv)$/i;

export class InboxWatcher extends EventEmitter {
  constructor({ config, settings, store, notifier, now = () => new Date(), stableMs = 1500, createOpts = {} }) {
    super();
    Object.assign(this, { config, settings, store, notifier, now, stableMs, createOpts });
    this.stateFile = path.join(config.dataDir, 'inbox.json');
    this.state = fs.existsSync(this.stateFile) ? JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) : { seen: {} };
    this.watcher = null; this.timer = null; this.busy = false;
  }

  get dir() { return this.settings.get().paths.inbox; }

  key(name, st) { return `${name}|${st.size}|${Math.round(st.mtimeMs)}`; }

  start() {
    this.stop();
    if (!this.settings.get().inbox.enabled) return;
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch (e) { this.emit('error', e); return; }
    try {
      this.watcher = fs.watch(this.dir, { persistent: false }, () => this.soon());
      this.watcher.on('error', () => {}); // network folders can drop the watch; the interval below still scans
    } catch { /* fall back to polling */ }
    this.timer = setInterval(() => this.scan(), 60_000);
    this.timer.unref?.();
    this.soon();
  }

  stop() {
    this.watcher?.close(); this.watcher = null;
    clearInterval(this.timer); this.timer = null;
    clearTimeout(this.pending);
  }

  soon() { clearTimeout(this.pending); this.pending = setTimeout(() => this.scan(), this.stableMs); }

  /** Look for new sheets. Returns the jobs created. Safe to call any time. */
  async scan() {
    if (this.busy) return [];
    this.busy = true;
    const created = [];
    try {
      if (!fs.existsSync(this.dir)) return created;
      for (const name of fs.readdirSync(this.dir)) {
        if (!SHEET.test(name) || name.startsWith('~$') || name.startsWith('.')) continue;
        const file = path.join(this.dir, name);
        let st = fs.statSync(file);
        if (!st.isFile() || this.state.seen[this.key(name, st)]) continue;
        // still being copied? wait until the size stops changing
        await new Promise((r) => setTimeout(r, this.stableMs));
        const st2 = fs.statSync(file);
        if (st2.size !== st.size || st2.size === 0) continue;
        st = st2;
        const job = this.makeDraft(name, file);
        this.state.seen[this.key(name, st)] = job.id;
        writeJsonAtomic(this.stateFile, this.state);
        created.push(job);
      }
    } catch (e) {
      this.emit('error', e);
    } finally { this.busy = false; }
    return created;
  }

  makeDraft(name, file) {
    const d = this.settings.get().newWeek;
    const g = guessFromFileName(name, this.now());
    const job = this.store.create({
      offer_name: g.offer_name || d.offerName, kicker_ar: d.kickerAr, kicker_en: g.offer_name || d.offerName,
      dates_ar: g.dates_ar || '', dates_en: g.dates_en || '', look: d.look, deliverables: d.deliverables, tasks: d.tasks, source: 'inbox',
    }, this.createOpts);
    const saved = this.store.addInput(job.id, name, fs.readFileSync(file));
    job.inputs.push({ name: saved, role: 'sheet', size: fs.statSync(file).size, addedAt: new Date().toISOString(), from: file });
    job.inboxGuess = { fromFile: name, offer_name: !!g.offer_name, dates: !!g.dates_en };
    this.store.save(job);
    this.store.log(job.id, { type: 'app', text: `Draft created from the Offers Inbox: ${name}` });
    this.emit('draft', job);
    this.notifier?.send({
      kind: 'inbox', title: 'New offer sheet', jobId: job.id, url: `#/new/${job.id}`,
      body: `${job.offer_name}${g.dates_en ? `, ${g.dates_en}` : ''}. Check the dates and look, then start the week.`,
    });
    return job;
  }
}
