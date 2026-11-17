// Mock Offers Agent (AGENT_MODE=mock): writes a canned review.json and sample files for each stage, so the
// whole loop (runner, API, Studio) can be tested without spending real agent runs.
// Uses the toolkit smoke renders in data/smoke/ when they exist (real-looking pages), SVG placeholders otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT } from '../toolkit.js';

const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(new Error('Cancelled'));
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Cancelled')); }, { once: true });
});

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function svgPage({ w = 1080, h = 1350, title, sub = '', n, accent = '#A12222', note = '' }) {
  const cards = [];
  const cols = w > h ? 4 : 3, rows = w > h ? 1 : 2;
  const gx = 48, top = w > h ? 220 : 300, cw = (w - gx * 2 - 18 * (cols - 1)) / cols, ch = w > h ? 470 : 440;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = gx + c * (cw + 18), y = top + r * (ch + 18);
    cards.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="22" fill="#fff"/>
<circle cx="${x + cw / 2}" cy="${y + ch * 0.38}" r="${Math.min(cw, ch) * 0.28}" fill="#F0ECE5"/>
<rect x="${x + 24}" y="${y + ch - 76}" width="${cw * 0.42}" height="52" rx="12" fill="${accent}"/>
<rect x="${x + cw - 24 - cw * 0.5}" y="${y + ch - 150}" width="${cw * 0.5}" height="20" rx="6" fill="#111" opacity=".8"/>
<rect x="${x + cw - 24 - cw * 0.35}" y="${y + ch - 118}" width="${cw * 0.35}" height="14" rx="5" fill="#6d6a66" opacity=".6"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#F5F5F2"/>
<rect x="${w - 560}" y="60" width="520" height="${w > h ? 120 : 150}" rx="20" fill="${accent}"/>
<text x="${w - 70}" y="${w > h ? 138 : 152}" font-family="Tahoma, Arial" font-size="${w > h ? 52 : 60}" font-weight="700" fill="#fff" text-anchor="end" direction="rtl">${esc(title)}</text>
<text x="60" y="110" font-family="Arial" font-size="34" font-weight="700" fill="#111">${String(n).padStart(2, '0')}</text>
<text x="60" y="150" font-family="Arial" font-size="20" fill="#6d6a66">${esc(sub)}</text>
${cards.join('\n')}
<text x="${w / 2}" y="${h - 40}" font-family="Arial" font-size="18" fill="#6d6a66" text-anchor="middle">MOCK · ${esc(note)}</text>
</svg>`;
}

function tinyPdf(text) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 540 675] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 22 Tf 60 600 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return pdf;
}

const SECTIONS = [
  ['meat', 'لحوم ودجاج', 'Meat & Poultry'], ['produce', 'خضار وفواكه', 'Fruits & Vegetables'], ['dairy', 'ألبان وأجبان', 'Dairy & Cheese'],
  ['pantry', 'المونة', 'Pantry Essentials'], ['bread', 'خبز وراب', 'Bread & Wraps'], ['healthy', 'سناك صحّي', 'Healthy Snacks'],
  ['snacks', 'بسكويت ومشروب', 'Biscuits & Drinks'], ['frozen', 'المثلجات', 'Frozen Food'], ['home', 'تنظيف وبيت', 'Home & Cleaning'],
];

/** Sample card rows: from build/items2.json when present (real names), else a short canned list. */
function sampleCards(jobDir) {
  const f = path.join(jobDir, 'build', 'items2.json');
  let items = [];
  try { items = JSON.parse(fs.readFileSync(f, 'utf8')).filter((r) => r.code && r.code !== 'Diwan Item Number'); } catch { /* none */ }
  if (!items.length) items = [
    { code: 'DAIRYSRV-001', ar: 'حلّوم روابي تعنايل', en: 'Rawabi Taanayel Halloum', uom: '200 g', price: 3.49, saving: -0.15, div: 'dairy' },
    { code: 'FLAKS-112', ar: 'كوكيز شوفان طاقة', en: 'Taqa Oat Cookies', uom: '40 g', price: 1.11, saving: -0.13, div: 'healthy' },
    { code: 'HHLDS-1683', ar: 'أكياس سندويش فيرا', en: 'Vera Sandwich Bags', uom: '150 bags', price: 1.99, saving: -0.2, div: 'home' },
  ];
  return items.slice(0, 48).map((r, i) => {
    const sec = SECTIONS[i % SECTIONS.length];
    const sav = typeof r.saving === 'number' && r.saving < 0 ? Math.floor(-r.saving * 100) : null;
    return { n: i + 1, section: sec[0], section_ar: sec[1], ar: r.ar || r.en, en: r.en, unit: r.uom || '', price: typeof r.price === 'number' ? r.price : null,
      saving: sav && sav >= 10 ? `${sav}%` : '', codes: [r.code], photos: [] };
  });
}

function smokeDir() {
  const d = path.join(ROOT, 'data', 'smoke');
  if (!fs.existsSync(d)) return null;
  for (const look of ['classic', ...fs.readdirSync(d)]) {
    const out = path.join(d, look, 'out');
    if (fs.existsSync(out) && fs.readdirSync(out).some((f) => /^flyer-\d+\.png$/.test(f))) return path.join(d, look);
  }
  return null;
}

const CARD_EDIT = /price|سعر|\$|merge|split|دمج|card|name|اسم|remove|add/i;

/**
 * createMockAgent(options)
 *   delayMs     ms between fake steps (default 120; tests use 0)
 *   failOn      { flyer: 1 } or "flyer:1" (env MOCK_FAIL): throw on that stage+round, first attempt only
 *   invalidOn   { cards: 1 }: finish without writing review.json (first attempt only)
 *   cardsChanged  true | false | undefined (default: guess from the edit text)
 *   useSmoke    use data/smoke renders if present (default true)
 */
export function createMockAgent(options = {}) {
  const parse = (v) => (typeof v === 'string' ? Object.fromEntries(v.split(',').filter(Boolean).map((p) => { const [s, r] = p.split(':'); return [s, +(r || 1)]; })) : v || {});
  const failOn = parse(options.failOn ?? process.env.MOCK_FAIL);
  const invalidOn = parse(options.invalidOn);
  const delay = options.delayMs ?? +(process.env.MOCK_DELAY_MS ?? 120);
  const useSmoke = options.useSmoke ?? true;

  return {
    mode: 'mock',
    async run({ job, stage, round, prompt, sessionId, jobDir, signal, onMessage = () => {} }) {
      const sid = (round.edits.length && sessionId) || `mock-${randomUUID()}`;
      onMessage({ type: 'system', subtype: 'init', text: `mock agent · session ${sid.slice(0, 13)} · skills: diwan-offers-pipeline, diwan-brand-rules, diwan-look-${job.look}, diwan-design-review`, sessionId: sid });
      onMessage({ type: 'prompt', text: prompt });
      const steps = STEP_TEXT[stage] || [['text', `Working on ${stage}…`]];
      for (const [type, text] of steps) { await sleep(delay, signal); onMessage({ type, text }); }
      if (failOn[stage] === round.n && (round.attempts || 1) === 1) { // fails once; a retry succeeds
        await sleep(delay, signal);
        throw new Error(`Mock failure in ${stage} round ${round.n} (python build_full.py exited with code 1)`);
      }
      const rdir = path.join(jobDir, 'review', stage, `r${round.n}`);
      fs.mkdirSync(rdir, { recursive: true });
      const rel = (f) => path.posix.join('review', stage, `r${round.n}`, f);
      const out = BUILDERS[stage]({ job, round, rdir, rel, jobDir, smoke: useSmoke ? smokeDir() : null });
      const edits = round.edits || [];
      const cardsChanged = options.cardsChanged ?? (edits.some((e) => e.kind === 'card' || CARD_EDIT.test(e.text)) && !['intake', 'images'].includes(stage));
      const review = {
        stage, round: round.n,
        summary: out.summary + (edits.length ? ` Applied ${edits.length} edit${edits.length > 1 ? 's' : ''} from round ${round.n - 1}.` : ''),
        changes: edits.map((e) => `${e.page ? `Page ${e.page}: ` : e.card ? `${e.card}: ` : ''}${e.text}`),
        files: out.files, checks: out.checks || {}, questions: out.questions || [], assumptions: out.assumptions || [],
        rules_added: edits.filter((e) => e.standing).map((e) => `Added to diwan-brand-rules: ${e.text}`),
        ...(cardsChanged ? { cards_changed: true } : {}),
      };
      if (round.kind === 'rerun') review.changes.unshift(`Rebuilt: ${round.reason || 'cards changed upstream'}`);
      await sleep(delay, signal);
      if (!(invalidOn[stage] === round.n && (round.attempts || 1) === 1)) {
        fs.writeFileSync(path.join(jobDir, 'review', stage, 'review.json'), JSON.stringify(review, null, 2), 'utf8');
      }
      const cost = +(0.05 + Math.random() * 0.4).toFixed(3);
      onMessage({ type: 'result', subtype: 'success', text: `done · $${cost}`, cost, sessionId: sid });
      return { sessionId: sid, cost };
    },
  };
}

const STEP_TEXT = {
  intake: [['tool', 'Read · inputs/offer-sheet.xlsx'], ['tool', 'Bash · python -c "import openpyxl…"'], ['text', 'Sheet has 143 rows in 9 sections. 2 prices missing, 1 duplicate code.'], ['tool', 'Write · build/items2.json']],
  images: [['tool', 'Glob · 005 - FMCG Items/**/*.png'], ['text', 'Matched 112 of 135 codes to library photos.'], ['tool', 'Bash · python build/prep_new.py'], ['tool', 'Bash · python build/prep_imgs.py']],
  cards: [['tool', 'Skill · diwan-brand-rules'], ['tool', 'Write · build/cards2.py'], ['text', 'Grouped 135 SKUs into 108 cards; same-price flavours share a card.']],
  flyer: [['tool', 'Skill · diwan-look'], ['tool', 'Bash · python build/build_full.py'], ['tool', 'Bash · node build/render.js build 1 flyer'], ['tool', 'Bash · node build/check.js build'], ['tool', 'Skill · diwan-design-review'], ['text', 'Design review: balanced the dairy pages (4+3 → 4+4 split).']],
  exports: [['tool', 'Bash · node build/render_final.js build'], ['tool', 'Bash · python build/flatten_pdf.py'], ['tool', 'Bash · python build/mobile_build.py']],
  social: [['tool', 'Bash · python build/build_social.py'], ['tool', 'Bash · node build/check_social.js build'], ['text', 'Merged bread + healthy snacks onto shared slides to fit 20.']],
  video: [['tool', 'Bash · python build/build_169.py'], ['tool', 'Bash · node build/render169.js build'], ['tool', 'Bash · python build/make.py']],
  delivery: [['tool', 'Bash · copy finals to Claude outputs'], ['tool', 'Grep · ديواني|مجلد|أصلي|بلوك|Privé|QR'], ['text', 'QA greps clean.']],
};

const BUILDERS = {
  intake({ job, rdir, rel, jobDir }) {
    const cards = sampleCards(jobDir);
    const rows = cards.map((c) => `<tr><td>${c.codes[0]}</td><td dir="rtl">${esc(c.ar)}</td><td>${esc(c.en)}</td><td>${esc(c.unit)}</td><td>${c.price ?? '<b>missing</b>'}</td><td>${c.saving}</td></tr>`).join('');
    fs.writeFileSync(path.join(rdir, 'inventory.html'), `<!doctype html><meta charset="utf-8"><style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#A12222;color:#fff}</style>
<h2>Inventory · ${esc(job.offer_name)} ${esc(job.dates_en)}</h2><table><tr><th>Code</th><th>Arabic</th><th>English</th><th>UOM</th><th>Price</th><th>Saving</th></tr>${rows}</table>`, 'utf8');
    return {
      summary: `Sheet read: ${cards.length} rows shown, 9 sections, USD except produce in L.L.`,
      files: [{ path: rel('inventory.html'), kind: 'html', label: 'Inventory' }],
      checks: { rows: 143, sections: 9, missing_prices: 2, duplicates: 1, no_photo_match: 23 },
      questions: [
        { id: 'q1', text: 'Kiri 24 portions has no price in the sheet. Price?', blocking: false },
        { id: 'q2', text: 'Code DAIRYSRV-014 appears twice with different prices (2.49$ and 2.99$). Which one?', blocking: true },
      ],
      assumptions: ['Produce prices taken from the separate LBP list'],
    };
  },
  images({ rdir, rel, smoke }) {
    const f = 'contact.svg';
    fs.writeFileSync(path.join(rdir, f), svgPage({ w: 1520, h: 1000, title: 'Contact sheet', sub: '112 matched · 23 missing', n: 1, note: 'images' }), 'utf8');
    fs.writeFileSync(path.join(rdir, 'missing.txt'), 'Kiri 24 portions – no photo\nDimex 6 kg – photo shows 3 kg\nSpontex floor cloth – low-res (408 px)\n', 'utf8');
    return {
      summary: '112 of 135 photos matched; 23 missing or wrong size.',
      files: [{ path: rel(f), kind: 'image', label: 'Contact sheet' }, { path: rel('missing.txt'), kind: 'text', label: 'Missing / low-res photos' }],
      checks: { matched: 112, missing: 23, low_res: 4 },
      assumptions: ['Used the 400 g bag photo for Chtoura peas 800 g'],
    };
  },
  cards({ rdir, rel, jobDir }) {
    const cards = sampleCards(jobDir);
    fs.writeFileSync(path.join(rdir, 'cards.json'), JSON.stringify(cards, null, 1), 'utf8');
    return {
      summary: `${cards.length} cards in 9 sections.`,
      files: [{ path: rel('cards.json'), kind: 'table', label: 'Card list' }],
      checks: { cards: cards.length, skus: cards.length, sheet_skus: cards.length },
      assumptions: ["Used 'ابتداءً من' for Puck spreads (3 prices)"],
    };
  },
  flyer({ job, round, rdir, rel, smoke }) {
    let files = [];
    if (smoke) {
      const pngs = fs.readdirSync(path.join(smoke, 'out')).filter((f) => /^flyer-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
      files = pngs.map((f, i) => {
        const name = `page-${String(i + 1).padStart(2, '0')}.png`;
        fs.copyFileSync(path.join(smoke, 'out', f), path.join(rdir, name));
        return { path: rel(name), kind: 'image', label: `${String(i + 1).padStart(2, '0')} · ${i === 0 ? 'Index' : 'Page'}` };
      });
    }
    if (!files.length) files = SECTIONS.slice(0, 7).map(([k, ar, en], i) => {
      const name = `page-${String(i + 1).padStart(2, '0')}.svg`;
      fs.writeFileSync(path.join(rdir, name), svgPage({ title: i ? ar : 'حديث الأسبوع!', sub: i ? en : 'Index', n: i + 1, note: `flyer r${round.n} · ${job.look}` }), 'utf8');
      return { path: rel(name), kind: 'image', label: `${String(i + 1).padStart(2, '0')} · ${i ? en : 'Index'}` };
    });
    fs.writeFileSync(path.join(rdir, 'flyer.pdf'), tinyPdf(`Preview PDF - ${job.tag} - round ${round.n}`));
    files.push({ path: rel('flyer.pdf'), kind: 'pdf', label: 'Preview PDF' });
    return { summary: `${files.length - 1} pages, look: ${job.look}.`, files, checks: { pages: files.length - 1, overflow: 0, alignment: 'ok', cards: 108, skus: 135, sheet_skus: 135 } };
  },
  exports({ job, rdir, rel, smoke }) {
    const files = [];
    const pdf = smoke && fs.existsSync(path.join(smoke, 'final')) && fs.readdirSync(path.join(smoke, 'final')).find((f) => f.endsWith('_flat.pdf'));
    if (pdf) fs.copyFileSync(path.join(smoke, 'final', pdf), path.join(rdir, 'interactive.pdf'));
    else fs.writeFileSync(path.join(rdir, 'interactive.pdf'), tinyPdf(`Interactive PDF - ${job.tag}`));
    files.push({ path: rel('interactive.pdf'), kind: 'pdf', label: 'Interactive PDF (flattened)' });
    const mob = smoke && fs.readdirSync(smoke).find((f) => f.endsWith('_Mobile.html'));
    if (mob) fs.copyFileSync(path.join(smoke, mob), path.join(rdir, 'mobile.html'));
    else fs.writeFileSync(path.join(rdir, 'mobile.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="only light"><body style="margin:0;background:#F0ECE5;font:16px system-ui"><div style="background:#A12222;color:#fff;padding:24px"><h1 dir="rtl" style="margin:0">حديث الأسبوع!</h1><p>${esc(job.dates_en)}</p></div><p style="padding:24px">Mock mobile page</p></body>`, 'utf8');
    files.push({ path: rel('mobile.html'), kind: 'html', label: 'Mobile page' });
    return { summary: 'Flattened PDF, 2x PNGs and the mobile page are ready.', files, checks: { pdf_pages: 22, internal_links: 198, web_links: 66, mobile_light_in_dark: 'ok' } };
  },
  social({ job, round, rdir, rel }) {
    const files = SECTIONS.slice(0, 6).map(([k, ar, en], i) => {
      const name = `slide-${String(i + 1).padStart(2, '0')}.svg`;
      fs.writeFileSync(path.join(rdir, name), svgPage({ title: i ? ar : 'اسحب وشوف كل العروض', sub: i ? en : 'Cover', n: i + 1, note: `carousel r${round.n}` }), 'utf8');
      return { path: rel(name), kind: 'image', label: `${String(i + 1).padStart(2, '0')} · ${i ? en : 'Cover'}` };
    });
    fs.writeFileSync(path.join(rdir, 'caption.txt'), `عروض نهاية الأسبوع وصلت! 🔥\n${job.dates_ar}\nحمّل تطبيق ديوان… الرابط بالبايو\nتوفير بطووول!\n\nWeekend offers are here, ${job.dates_en}. Download the Diwan app, link in bio.\n\n#ديوان_ماركت #توفير_بطووول #DiwanMarket\n`, 'utf8');
    files.push({ path: rel('caption.txt'), kind: 'text', label: 'Caption' });
    return { summary: '20 slides in one post, caption ready.', files, checks: { slides: 20, posts: 1, cards: 108, overflow: 0 } };
  },
  video({ round, rdir, rel, smoke }) {
    const files = SECTIONS.slice(0, 5).map(([k, ar, en], i) => {
      const name = `s-${String(i + 1).padStart(2, '0')}.svg`;
      fs.writeFileSync(path.join(rdir, name), svgPage({ w: 1920, h: 1080, title: i ? ar : 'حديث الأسبوع!', sub: i ? en : 'Index', n: i + 1, note: `16:9 r${round.n}` }), 'utf8');
      return { path: rel(name), kind: 'image', label: `${String(i + 1).padStart(2, '0')} · ${i ? en : 'Index'}` };
    });
    const mp4 = smoke && fs.readdirSync(smoke).find((f) => f.endsWith('_Slideshow.mp4'));
    if (mp4) { fs.copyFileSync(path.join(smoke, mp4), path.join(rdir, 'slideshow.mp4')); files.push({ path: rel('slideshow.mp4'), kind: 'video', label: 'Slideshow' }); }
    return { summary: `32 slides, ${mp4 ? '160 s video' : 'video skipped in mock (no smoke MP4)'}.`, files, checks: { slides: 32, seconds: 160.7 } };
  },
  delivery({ job, rdir, rel }) {
    const list = ['Interactive.pdf', 'Mobile.html', 'Carousel.zip', '16x9_Slides.zip', 'Slideshow.mp4'].map((s) => `Diwan-${job.tag}_${s}`);
    fs.writeFileSync(path.join(rdir, 'delivered.txt'), list.join('\n') + '\n', 'utf8');
    return { summary: `${list.length} files delivered to Claude outputs\\${job.tag}\\ (mock: nothing copied).`, files: [{ path: rel('delivered.txt'), kind: 'text', label: 'Delivered files' }], checks: { files: list.length, qa_greps: 'clean' } };
  },
};
