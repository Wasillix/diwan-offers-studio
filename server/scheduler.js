// Weekly reminder: at the set day and time (default Monday 10:00, Asia/Beirut) create a draft week for the
// coming Friday–Monday from the template and nudge Waseem to drop the sheet. Fires once per day; if the PC
// was off at 10:00 it fires the first time the app runs later that day.
import { EventEmitter } from 'node:events';
import { zonedParts, upcomingWeekend } from './dates.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class Scheduler extends EventEmitter {
  constructor({ settings, store, notifier, now = () => new Date(), createOpts = {} }) {
    super();
    Object.assign(this, { settings, store, notifier, now, createOpts });
    this.timer = null;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this.tick(), 30_000);
    this.timer.unref?.();
    this.tick();
  }

  stop() { clearInterval(this.timer); this.timer = null; }

  /** Is it time? (right weekday, at or after the time, not fired today). Returns the job created, if any. */
  tick() {
    const s = this.settings.get().schedule;
    if (!s.enabled) return null;
    const z = zonedParts(this.now(), s.timeZone);
    const hhmm = `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
    if (z.weekday !== s.weekday || hhmm < s.time || s.lastFired === z.ymd) return null;
    return this.fire(z.ymd);
  }

  fire(ymd) {
    const st = this.settings.get();
    const s = st.schedule, d = st.newWeek;
    const wk = upcomingWeekend(this.now());
    let job = null;
    if (s.createDraft) {
      const existing = this.store.list().find((j) => j.dates_en === wk.en);
      if (existing) job = existing;
      else {
        job = this.store.create({
          offer_name: d.offerName, kicker_ar: d.kickerAr, kicker_en: d.offerName, dates_ar: wk.ar, dates_en: wk.en,
          look: d.look, deliverables: d.deliverables, tasks: d.tasks, source: 'reminder',
        }, this.createOpts);
        this.store.log(job.id, { type: 'app', text: 'Draft created by the weekly reminder' });
      }
    }
    this.settings.update({ schedule: { lastFired: ymd } });
    this.emit('fired', job);
    this.notifier?.send({
      kind: 'reminder', title: 'Weekly offers', jobId: job?.id, url: job ? `#/new/${job.id}` : '#/new',
      body: job
        ? `Draft ready for ${job.dates_en}. Drop Diwan's sheet in the Offers Inbox or attach it to the draft.`
        : 'Time to start this week\'s offers. Drop Diwan\'s sheet in the Offers Inbox.',
    });
    return job;
  }

  /** "Monday 24 November, 10:00 (Asia/Beirut)" for the Settings screen. */
  nextRun() {
    const s = this.settings.get().schedule;
    if (!s.enabled) return null;
    const now = this.now();
    for (let i = 0; i <= 7; i++) {
      const day = new Date(now.getTime() + i * 86400_000);
      const z = zonedParts(day, s.timeZone);
      if (z.weekday !== s.weekday) continue;
      const nowZ = zonedParts(now, s.timeZone);
      const hhmm = `${String(nowZ.hour).padStart(2, '0')}:${String(nowZ.minute).padStart(2, '0')}`;
      if (i === 0 && (hhmm >= s.time || s.lastFired === z.ymd)) continue;
      const date = new Date(Date.UTC(z.year, z.month - 1, z.day));
      return `${DAYS[z.weekday]} ${date.getUTCDate()} ${date.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}, ${s.time} (${s.timeZone})`;
    }
    return null;
  }
}
