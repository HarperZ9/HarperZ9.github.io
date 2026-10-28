// Reference tags: small numbered brass discs over the art. Each opens a card with the real object, a short quote
// (one per source, attributed), its sources with a check status, and links to other rooms where the motif recurs.
import { el, esc, BADGE } from './core.js';

export function lsbRead(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let bit = 0, acc = 0, nb = 0; const out = []; let need = -1;
  for (let i = 0; i < d.length; i++) { if (i % 4 === 3) continue; acc = (acc << 1) | (d[i] & 1); if (++nb === 8) { out.push(acc); acc = 0; nb = 0;
      if (out.length === 2 && need < 0) { need = (out[0] << 8) | out[1]; if (need <= 0 || need > 600) return null; }
      if (need > 0 && out.length === need + 2) break; } }
  if (need < 0 || out.length < need + 2) return null;
  return new TextDecoder().decode(new Uint8Array(out.slice(2)));
}

export function mountTags(D, cfg) {
  if (!(cfg.tags || []).length) return { refresh() {} };
  const layers = new Map(), pick = h => (typeof h === 'string' ? document.querySelector(h) : h);
  const layerFor = T => { const hostEl = pick(T.host || cfg.host); if (!hostEl) return null; if (!layers.has(hostEl) || !layers.get(hostEl).isConnected) { if (getComputedStyle(hostEl).position === 'static') hostEl.style.position = 'relative'; const l = el('div', 'dp-tags'); hostEl.append(l); layers.set(hostEl, l); } return layers.get(hostEl); };
  let openId = null, card = null;
  const close = (focus = true) => { if (card) { const t = document.querySelector(`.dp-tag[data-tag="${openId}"]`); card.remove(); card = null; if (t) { t.setAttribute('aria-expanded', 'false'); if (focus) t.focus(); } openId = null; } };
  function open(T, btn) {
    const layer = layerFor(T); close(false); openId = T.id; btn.setAttribute('aria-expanded', 'true'); card = el('div', 'dp-card'); card.setAttribute('role', 'group'); card.setAttribute('aria-label', 'Reference: ' + T.title);
    card.style.setProperty('--tx', T.x + '%'); card.style.setProperty('--ty', T.y + '%'); card.dataset.side = T.x > 55 ? 'left' : 'right'; card.dataset.vert = T.y > 60 ? 'up' : 'down';
    let h = `<button type="button" class="dp-x" aria-label="Close reference">Close</button><p class="dp-kind">${esc(T.kind || 'Reference')}</p><h3>${T.title}</h3><div class="dp-body">${T.body}</div>`;
    if (T.quote) h += `<blockquote>${T.quote.t}<cite>${T.quote.by}${T.quote.u ? ` <a href="${esc(T.quote.u)}" rel="noopener">source</a>` : ''}</cite></blockquote>`;
    if (T.plate) h += `<figure class="dp-plate"><img alt="${esc(T.plate.alt)}" src="${esc(T.plate.src)}" width="${T.plate.w || 320}"><figcaption>${T.plate.cap}</figcaption><button type="button" class="dp-bits">Read the lowest bits</button><output class="dp-bitout" aria-live="polite"></output></figure>`;
    if (T.src && T.src.length) h += '<ul class="dp-src">' + T.src.map(s => `<li>${s.u ? `<a href="${esc(s.u)}" rel="noopener">${s.t}</a>` : s.t} <em class="dp-s dp-s-${s.s}">${BADGE[s.s]}</em></li>`).join('') + '</ul>';
    if (T.rooms && T.rooms.length) h += '<p class="dp-also">Also in: ' + T.rooms.map(r => `<a href="${esc(r.room)}.html">${esc(r.label)}</a> (${esc(r.why)})`).join('; ') + '</p>';
    card.innerHTML = h; layer.append(card); card.querySelector('.dp-x').onclick = () => close();
    const bb = card.querySelector('.dp-bits'); if (bb) bb.onclick = () => { const im = card.querySelector('img'), out = card.querySelector('.dp-bitout');
      const run = () => { let m = null; try { m = lsbRead(im); } catch (e) { console.error('bit read failed', e); } out.textContent = m ? m : 'Nothing readable in the lowest bits. Is this the lossless copy?'; if (m) D.markFound('plate', 'The lowest bits hold a line: ' + m); };
      if (im.complete) run(); else im.onload = run; };
    if (T.onopen) T.onopen(card, D);
    card.querySelector('.dp-x').focus({ preventScroll: true });
  }
  function refresh() {
    const keep = openId; close(false); document.querySelectorAll('.dp-tag').forEach(n => n.remove()); let n = 0;
    (cfg.tags).forEach(T => {
      if (!D.has(T.layer || 'l1')) return; const layer = layerFor(T); if (!layer) return; n++;
      const b = el('button', 'dp-tag', `<span aria-hidden="true">${n}</span>`); b.type = 'button'; b.dataset.tag = T.id; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', `Reference ${n}: ${T.title.replace(/<[^>]+>/g, '')}`);
      b.style.left = T.x + '%'; b.style.top = T.y + '%'; b.onclick = e => { e.stopPropagation(); if (openId === T.id) close(); else open(T, b); }; layer.append(b);
    });
    if (keep) { const T = cfg.tags.find(t => t.id === keep), b = document.querySelector(`.dp-tag[data-tag="${keep}"]`); if (T && b) open(T, b); }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && card) { e.stopPropagation(); close(); } });
  document.addEventListener('pointerdown', e => { if (card && !card.contains(e.target) && !e.target.closest('.dp-tag')) close(false); });
  const pl = cfg.tags.find(t => t.plate);
  D.showPlate = () => { if (!pl) return; const im = new Image(); im.onload = () => { const m = lsbRead(im); D.markFound('plate', m ? 'The plate says: ' + m : 'No line found.'); const o = document.createElement('p'); o.className = 'dp-plateout'; o.setAttribute('role', 'status'); o.textContent = 'Plate: ' + (m || 'no line found'); D.section.querySelector('.dp-marks').after(o); }; im.src = pl.plate.src; };
  refresh(); return { refresh, close };
}
