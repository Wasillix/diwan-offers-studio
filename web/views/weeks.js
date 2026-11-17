// Weeks: every offer week, newest first, with its stage strip and what it needs from Waseem.
import { esc, get, getMeta, listen, chip, money, ago, txt } from '../lib.js';

const NEXT = {
  draft: 'Draft · confirm to start',
  queued: 'Waiting for the agent',
  done: 'Delivered',
};

function nextLine(w, stages) {
  if (NEXT[w.state]) return NEXT[w.state];
  const cur = stages.find((s) => s.key === w.current);
  if (!cur) return '';
  if (w.state === 'awaiting_review' || w.state === 'question') return `${cur.label}: ready for your review`;
  if (w.state === 'running') return `${cur.label}: agent working`;
  if (w.state === 'failed') return `${cur.label}: failed, needs a retry`;
  return cur.label;
}

export async function weeksView(root) {
  const meta = await getMeta();
  const lookTitle = Object.fromEntries(meta.looks.map((l) => [l.key, l.title]));

  async function draw() {
    const weeks = await get('/api/jobs');
    if (!weeks.length) {
      root.innerHTML = `<section class="page">
        <div class="panel empty">
          <h1>No offer weeks yet</h1>
          <p>Start a week from Diwan's offer sheet, or drop the sheet into the Offers Inbox folder and it will show up here as a draft.</p>
          <a class="btn btn-primary" href="#/new">New week</a>
        </div></section>`;
      return;
    }
    const waiting = weeks.filter((w) => ['awaiting_review', 'question', 'failed'].includes(w.state)).length;
    root.innerHTML = `<section class="page">
      <div class="page-head">
        <div>
          <h1>Offer weeks</h1>
          <p class="lede">${waiting ? `${waiting} week${waiting > 1 ? 's' : ''} waiting for you.` : 'Nothing waiting for you right now.'}</p>
        </div>
      </div>
      <div class="weeks" role="list">
        ${weeks.map((w) => `
          <a class="week-row ${['awaiting_review', 'question'].includes(w.state) ? 'wants' : ''} ${w.state === 'failed' ? 'failed' : ''}" role="listitem"
             href="${w.state === 'draft' ? `#/new/${esc(w.id)}` : `#/week/${esc(w.id)}`}">
            <div>
              <div class="week-name">${esc(w.offer_name)}</div>
              <div class="week-dates"><span class="num">${esc(w.dates_en || 'No dates yet')}</span>${w.dates_ar ? txt(w.dates_ar) : ''}</div>
            </div>
            <span class="look-tag"><i class="look-dot ${esc(w.look)}"></i>${esc(lookTitle[w.look] || w.look)}</span>
            <div>
              <div class="strip" aria-hidden="true">${meta.stages.map((s) => `<i class="${esc(w.stages[s.key])}" title="${esc(s.label)}"></i>`).join('')}</div>
              <div class="strip-label">${esc(nextLine(w, meta.stages))}</div>
            </div>
            <div>${chip(w.state)}<div class="strip-label">${esc(ago(w.updatedAt))}</div></div>
            <div class="week-cost num" title="Agent cost this week">${money(w.cost)}</div>
          </a>`).join('')}
      </div>
    </section>`;
  }

  await draw();
  let pending = null;
  const close = listen('/api/events', {
    job: () => { clearTimeout(pending); pending = setTimeout(draw, 250); },
    removed: () => draw(),
  });
  return close;
}
