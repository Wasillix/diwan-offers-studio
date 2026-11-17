// Full-screen page viewer with click-to-pin proof marks.
// open({ items:[{src,label,path,page}], index, pinnable, pinsFor(path)->[{n,x,y}], onPin({path,page,x,y,text}) })
import { $, esc } from '../lib.js';

export function openLightbox(opts) {
  const box = $('#lightbox');
  let i = opts.index || 0;
  let pinMode = !!opts.pinnable;
  let pop = null;

  function draw() {
    const it = opts.items[i];
    box.innerHTML = `
      <div class="lb-top">
        <span class="lb-title">${esc(it.label || '')} <span style="opacity:.6;font-weight:500">· ${i + 1} of ${opts.items.length}</span></span>
        ${opts.pinnable ? `<button class="btn btn-sm" id="lb-pin" aria-pressed="${pinMode}">${pinMode ? 'Pinning: click the page' : 'Pin a comment'}</button>` : ''}
        <a class="btn btn-sm" href="${esc(it.src)}" target="_blank" rel="noopener">Open full size</a>
        <button class="btn btn-sm" id="lb-close" aria-label="Close">Close</button>
      </div>
      <div class="lb-stage">
        ${opts.items.length > 1 ? '<button class="lb-nav lb-prev" aria-label="Previous page">‹</button>' : ''}
        <div class="lb-img ${pinMode ? 'pinning' : ''}"><img src="${esc(it.src)}" alt="${esc(it.label || '')}" draggable="false">
          ${(opts.pinsFor?.(it.path) || []).map((p) => `<span class="pin" data-x="${p.x}" data-y="${p.y}">${p.n}</span>`).join('')}
        </div>
        ${opts.items.length > 1 ? '<button class="lb-nav lb-next" aria-label="Next page">›</button>' : ''}
      </div>
      <div class="lb-foot">${opts.pinnable ? 'Click a spot on the page to pin a comment. ' : ''}← → to move between pages, Esc to close.</div>`;
    const img = $('.lb-img img', box);
    const place = () => {
      const k = img.clientWidth / (img.naturalWidth || img.clientWidth);
      box.querySelectorAll('.lb-img .pin').forEach((p) => { p.style.left = `${p.dataset.x * k}px`; p.style.top = `${p.dataset.y * k}px`; });
    };
    img.complete ? place() : img.addEventListener('load', place, { once: true });
    img.addEventListener('click', (e) => {
      if (!pinMode) return;
      const k = (img.naturalWidth || img.clientWidth) / img.clientWidth;
      const x = Math.round(e.offsetX * k), y = Math.round(e.offsetY * k);
      showPop(e.offsetX, e.offsetY, x, y);
    });
  }

  function showPop(px, py, x, y) {
    pop?.remove();
    const holder = $('.lb-img', box);
    holder.querySelector('.pin.draft')?.remove();
    holder.insertAdjacentHTML('beforeend', `<span class="pin draft" style="left:${px}px;top:${py}px">+</span>`);
    pop = document.createElement('div');
    pop.className = 'pin-pop';    const left = Math.min(px + 14, holder.clientWidth - 290);
    pop.style.left = `${Math.max(0, left)}px`; pop.style.top = `${Math.min(py + 14, holder.clientHeight - 140)}px`;
    pop.innerHTML = `<textarea class="input" placeholder="What should change here?" aria-label="Comment"></textarea>
      <div class="row"><button class="btn btn-sm btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-sm btn-mark" data-act="add">Add pin</button></div>`;
    holder.appendChild(pop);
    const ta = $('textarea', pop); ta.focus();
    const it = opts.items[i];
    const add = () => {
      if (!ta.value.trim()) return ta.focus();
      opts.onPin({ path: it.path, page: it.page, x, y, text: ta.value.trim() });
      pop.remove(); pop = null; draw();
    };
    pop.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.dataset.act === 'cancel') { holder.querySelector('.pin.draft')?.remove(); pop.remove(); pop = null; }
      if (e.target.dataset.act === 'add') add();
    });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add(); e.stopPropagation(); });
  }

  const close = () => { box.hidden = true; box.innerHTML = ''; document.removeEventListener('keydown', onKey); opts.onClose?.(); };
  const go = (d) => { i = (i + d + opts.items.length) % opts.items.length; pop = null; draw(); };
  function onKey(e) {
    if (e.key === 'Escape') { if (pop) { box.querySelector('.pin.draft')?.remove(); pop.remove(); pop = null; } else close(); }
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  }
  box.onclick = (e) => {
    if (e.target.id === 'lb-close' || e.target === box || e.target.classList.contains('lb-stage')) close();
    if (e.target.classList.contains('lb-prev')) go(-1);
    if (e.target.classList.contains('lb-next')) go(1);
    if (e.target.id === 'lb-pin') { pinMode = !pinMode; draw(); }
  };
  document.addEventListener('keydown', onKey);
  box.hidden = false;
  draw();
  $('#lb-close', box)?.focus();
  return close;
}
