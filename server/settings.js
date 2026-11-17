// Settings kept in data/settings.json (written atomically). Defaults below; saved values merge over them.
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { writeJsonAtomic } from './store.js';
import { DELIVERABLE_KEYS } from './stages.js';

export const DEFAULT_TASKS = [
  'Confirm no branch opened or closed',
  'Check app store links still work',
  'List missing, low-res or wrong-size photos for the client',
  'Cover hero: the week\'s biggest saving',
];

export function defaults(config) {
  return {
    paths: { inbox: config.inboxDir, outputs: config.outputsDir, imageLibrary: config.imageLibrary, logos: config.logosDir, toolkit: config.toolkitDir },
    newWeek: { look: 'classic', deliverables: [...DELIVERABLE_KEYS], tasks: [...DEFAULT_TASKS], offerName: 'Weekend Offers', kickerAr: 'عروض نهاية الأسبوع' },
    schedule: { enabled: true, weekday: 1, time: '10:00', timeZone: 'Asia/Beirut', createDraft: true, lastFired: null },
    inbox: { enabled: true },
    notifications: { toast: true, browser: true, telegram: false, on: { review: true, question: true, failed: true, done: true, inbox: true, reminder: true } },
    agent: { mode: config.agentMode, model: process.env.AGENT_MODEL || 'claude-opus-5-5', effort: process.env.AGENT_EFFORT || 'high', maxBudgetUsd: +(process.env.AGENT_MAX_BUDGET_USD || 15) },
  };
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

export class Settings extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.file = path.join(config.dataDir, 'settings.json');
    this.saved = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    this.value = merge(defaults(config), this.saved);
    this.applyToConfig();
  }

  get() { return this.value; }

  /** Partial update: { schedule: { time: '09:30' } }. Validates the risky fields. */
  update(patch) {
    const next = merge(this.value, patch || {});
    validate(next);
    this.saved = merge(this.saved, patch || {});
    this.value = next;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    writeJsonAtomic(this.file, this.saved);
    this.applyToConfig();
    this.emit('change', this.value, patch);
    return this.value;
  }

  /** Paths from Settings override the .env/defaults at runtime. */
  applyToConfig() {
    const p = this.value.paths;
    Object.assign(this.config, { inboxDir: p.inbox, outputsDir: p.outputs, imageLibrary: p.imageLibrary, logosDir: p.logos });
  }
}

function validate(s) {
  const t = s.schedule;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) throw Object.assign(new Error('Reminder time must be HH:MM (24 h)'), { code: 400 });
  if (!(Number.isInteger(t.weekday) && t.weekday >= 0 && t.weekday <= 6)) throw Object.assign(new Error('Reminder day must be 0–6'), { code: 400 });
  try { new Intl.DateTimeFormat('en', { timeZone: t.timeZone }); } catch { throw Object.assign(new Error(`Unknown time zone ${t.timeZone}`), { code: 400 }); }
  if (!['mock', 'real'].includes(s.agent.mode)) throw Object.assign(new Error('Agent mode must be mock or real'), { code: 400 });
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(s.agent.effort)) throw Object.assign(new Error('Unknown effort level'), { code: 400 });
  if (!(s.agent.maxBudgetUsd > 0 && s.agent.maxBudgetUsd <= 200)) throw Object.assign(new Error('Budget per run must be between $0 and $200'), { code: 400 });
  s.newWeek.deliverables = (s.newWeek.deliverables || []).filter((d) => DELIVERABLE_KEYS.includes(d));
  s.newWeek.tasks = (Array.isArray(s.newWeek.tasks) ? s.newWeek.tasks : String(s.newWeek.tasks || '').split(/\r?\n/)).map((x) => String(x).trim()).filter(Boolean);
}
