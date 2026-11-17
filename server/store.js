// Job store: one folder per offer week under data/jobs/<id>/ (BUILD_SPEC §8).
//   job.json (written atomically), log.jsonl (append-only), inputs/, build/ (toolkit copy), review/, final/
import fs from 'node:fs';
import path from 'node:path';
import { STAGES, STAGE_KEYS, DELIVERABLE_KEYS } from './stages.js';
import { prepareBuild } from './toolkit.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** "Weekend Offers" + "20 – 23 November 2026" -> "Weekend-20-23Nov". Falls back gracefully. */
export function makeTag(offerName, datesEn) {
  const name = String(offerName || 'Offers').replace(/\b(offers?|deals?)\b/gi, '').trim() || 'Offers';
  const word = name.split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  // any short separator between the days: "20 – 23", "20-23", "20 to 23", "30 Nov – 3 Dec"
  const m = String(datesEn || '').match(/(\d{1,2})\s*(?:[A-Za-z]+\s*)?(?:[^\dA-Za-z\s]{1,3}|to)\s*(\d{1,2})\s+([A-Za-z]{3})/);
  if (m) return `${word.replace(/[^A-Za-z0-9]/g, '')}-${m[1]}-${m[2]}${m[3][0].toUpperCase()}${m[3].slice(1, 3).toLowerCase()}`;
  const one = String(datesEn || '').match(/(\d{1,2})\s+([A-Za-z]{3})/);
  return `${word.replace(/[^A-Za-z0-9]/g, '')}${one ? `-${one[1]}${one[2][0].toUpperCase()}${one[2].slice(1, 3).toLowerCase()}` : ''}`;
}

export function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

export class JobStore {
  constructor(config) {
    this.config = config;
    fs.mkdirSync(config.jobsDir, { recursive: true });
  }

  dir(id, ...p) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`bad job id: ${id}`);
    return path.join(this.config.jobsDir, id, ...p);
  }

  exists(id) {
    try { return fs.existsSync(this.dir(id, 'job.json')); } catch { return false; }
  }

  get(id) {
    if (!this.exists(id)) return null;
    return JSON.parse(fs.readFileSync(this.dir(id, 'job.json'), 'utf8'));
  }

  list() {
    if (!fs.existsSync(this.config.jobsDir)) return [];
    return fs.readdirSync(this.config.jobsDir)
      .filter((id) => this.exists(id))
      .map((id) => this.get(id))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  save(job) {
    job.updatedAt = new Date().toISOString();
    writeJsonAtomic(this.dir(job.id, 'job.json'), job);
    return job;
  }

  /** New draft week. `copyToolkit:false` skips the build/ copy (tests). */
  create(fields = {}, { copyToolkit = true } = {}) {
    const now = new Date();
    const offerName = fields.offer_name || 'Weekend Offers';
    const tag = fields.tag || makeTag(offerName, fields.dates_en);
    const base = `${now.toISOString().slice(0, 10)}-${slugify(tag) || 'week'}`;
    let id = base, n = 2;
    while (fs.existsSync(path.join(this.config.jobsDir, id))) id = `${base}-${n++}`;
    const deliverables = (fields.deliverables || DELIVERABLE_KEYS).filter((d) => DELIVERABLE_KEYS.includes(d));
    const job = {
      id,
      status: 'draft',
      offer_name: offerName,
      kicker_ar: fields.kicker_ar || 'عروض نهاية الأسبوع',
      kicker_en: fields.kicker_en || offerName,
      dates_ar: fields.dates_ar || '',
      dates_en: fields.dates_en || '',
      tag,
      look: fields.look || 'classic',
      deliverables,
      tasks: Array.isArray(fields.tasks) ? fields.tasks.filter(Boolean) : String(fields.tasks || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      source: fields.source || 'manual',
      inputs: [],
      stages: Object.fromEntries(STAGES.map((s) => [s.key, { status: 'pending', rounds: [], pendingEdits: [] }])),
      questions: [],
      cost: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    for (const d of ['inputs', 'review', 'final']) fs.mkdirSync(this.dir(id, d), { recursive: true });
    if (copyToolkit) prepareBuild(this.dir(id, 'build'), this.offerJson(job), this.config.toolkitDir);
    else fs.mkdirSync(this.dir(id, 'build'), { recursive: true });
    fs.writeFileSync(this.dir(id, 'log.jsonl'), '', 'utf8');
    this.save(job);
    this.log(id, { type: 'app', text: `Week created (${job.source})` });
    return job;
  }

  /** The build/offer.json the toolkit reads, from the job's fields. */
  offerJson(job) {
    return {
      tag: job.tag,
      offer_name_en: job.offer_name,
      kicker_ar: job.kicker_ar,
      kicker_en: job.kicker_en,
      dates_ar: job.dates_ar,
      dates_en: job.dates_en,
      title_en: `${job.offer_name} ${job.dates_en}`.trim(),
      look: job.look,
      image_library: this.config.imageLibrary.replace(/\\/g, '/').replace(/\/?$/, '/'),
      logos_dir: this.config.logosDir.replace(/\\/g, '/').replace(/\/?$/, '/'),
    };
  }

  writeOfferJson(job) {
    const f = this.dir(job.id, 'build', 'offer.json');
    if (!fs.existsSync(path.dirname(f))) return;
    const cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
    writeJsonAtomic(f, { ...cur, ...this.offerJson(job) });
  }

  addInput(id, name, buffer) {
    const safe = path.basename(name).replace(/[<>:"|?*\x00-\x1f]/g, '_');
    fs.writeFileSync(this.dir(id, 'inputs', safe), buffer);
    return safe;
  }

  log(id, entry) {
    const line = JSON.stringify({ t: new Date().toISOString(), ...entry });
    fs.appendFileSync(this.dir(id, 'log.jsonl'), line + '\n', 'utf8');
    return JSON.parse(line);
  }

  readLog(id, { limit = 500 } = {}) {
    const f = this.dir(id, 'log.jsonl');
    if (!fs.existsSync(f)) return [];
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return { type: 'raw', text: l }; } });
  }

  readReview(id, stage) {
    const f = this.dir(id, 'review', stage, 'review.json');
    if (!fs.existsSync(f)) return null;
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  }

  /** A stored copy of each round's review.json, so round history survives the next round. */
  archiveReview(id, stage, round, review) {
    const d = this.dir(id, 'review', stage, `r${round}`);
    fs.mkdirSync(d, { recursive: true });
    writeJsonAtomic(path.join(d, 'review.json'), review);
  }

  readRoundReview(id, stage, round) {
    const f = this.dir(id, 'review', stage, `r${round}`, 'review.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  }
}

export { STAGE_KEYS };
