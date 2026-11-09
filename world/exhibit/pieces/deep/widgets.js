// Shared widgets: the riddle (answers compared as SHA-256 hashes) and the settling dots (hold still for 30 seconds).
import { el, esc, RM } from './core.js';
import { hashAnswer, norm } from './sha.js';

export function mountRiddle(D, cfg) {
  const R = cfg.riddle, box = el('details', 'dp-riddle'); if (!R) { box.hidden = true; return box; }
  box.innerHTML = `<summary>A puzzle for this room</summary><p class="dp-q">${R.q}</p><form class="dp-form"><label>Your answer <input type="text" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="dp-rout-${cfg.room}"></label><button type="submit">Check</button><button type="button" class="dp-showans">Show me the answer</button></form><p class="dp-rout" id="dp-rout-${cfg.room}" aria-live="polite"></p><p class="dp-rnote">The page holds a hash of the answer and compares hashes. It is a game, not a lock: anyone can read this page's code, and Show me gives the answer with its source.</p>`;
  const f = box.querySelector('form'), inp = box.querySelector('input'), out = box.querySelector('.dp-rout'); let tries = 0;
  const win = v => { out.innerHTML = `Right. Key word: <b class="dp-key">${esc(norm(v).toUpperCase())}</b>. Write it down. The last wall asks for all thirteen.`; D.markFound('riddle', 'Riddle solved.'); box.open = true; };
  f.onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (!v) { out.textContent = 'Type an answer first.'; return; }
    if (hashAnswer(v) === R.hash) win(v); else { tries++; out.textContent = tries >= 3 ? `No. ${R.hint}` : 'No. Try again.'; } };
  box.querySelector('.dp-showans').onclick = () => { out.innerHTML = `The answer is <b class="dp-key">${esc(R.answer.toUpperCase())}</b>. ${R.plain} It is also the key word for the last wall.`; D.markFound('riddle', 'The answer is shown.'); box.open = true; };
  if (D.mark('riddle')) out.innerHTML = 'Solved earlier on this browser. The key word is yours to keep: you wrote it down.';
  return box;
}

export function settle(D, cfg, host) {
  const N = cfg.number; if (!N || !host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const cv = el('canvas', 'dp-settle'); cv.setAttribute('aria-hidden', 'true'); host.append(cv);
  const cap = el('p', 'dp-numcap'); cap.hidden = true; cap.innerHTML = `<b>${esc(N.text)}</b> ${N.note} ${N.src ? `<a href="${esc(N.src)}" rel="noopener">Source</a>` : ''}`; host.append(cap);
  let still = 0, formed = false, dots = [], raf = 0, t0 = 0, fade = 1;
  const poke = () => { still = 0; if (formed) { formed = false; fade = 1; cap.hidden = true; cancelAnimationFrame(raf); fadeOut(); } };
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, poke, { passive: true }));
  function targets() {
    const r = host.getBoundingClientRect(), w = cv.width = Math.round(r.width), h = cv.height = Math.round(r.height), o = document.createElement('canvas'); o.width = w; o.height = h;
    const x = o.getContext('2d'), fs = Math.min(h * .5, w / (N.text.length * .62)); x.font = `800 ${fs}px "Hanken Grotesk", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(N.text, w / 2, h * .46);
    const d = x.getImageData(0, 0, w, h).data, pts = [], step = Math.max(4, Math.round(fs / 22));
    for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) if (d[(yy * w + xx) * 4 + 3] > 128) pts.push([xx, yy]);
    return { pts, w, h };
  }
  function draw(p) { const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.fillStyle = `rgba(255,233,58,${.9 * fade})`; for (const d of dots) { const e = p * p * (3 - 2 * p), px = d.sx + (d.tx - d.sx) * e, py = d.sy + (d.ty - d.sy) * e; x.beginPath(); x.arc(px, py, 2.2, 0, 7); x.fill(); } }
  function form(manual) {
    if (formed) return; const { pts, w, h } = targets(); if (!pts.length) return; formed = true; fade = 1; cv.style.opacity = 1;
    dots = pts.map(([tx, ty]) => ({ tx, ty, sx: Math.random() * w, sy: Math.random() * h })); t0 = performance.now();
    const tick = now => { const p = RM ? 1 : Math.min(1, (now - t0) / 2600); draw(p); if (p < 1 && formed) raf = requestAnimationFrame(tick); else if (formed) { cap.hidden = false; D.markFound('number', `The dots settled into ${N.text}. ${N.note.replace(/<[^>]+>/g, '')}`); } };
    raf = requestAnimationFrame(tick);
  }
  function fadeOut() { const s = performance.now(), tick = now => { fade = 1 - Math.min(1, (now - s) / 500); const x = cv.getContext('2d'); x.globalAlpha = 1; draw(1); if (fade > 0) requestAnimationFrame(tick); else cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }; requestAnimationFrame(tick); }
  setInterval(() => { if (document.hidden) return; still++; if (still >= 30 && !formed) form(); }, 1000);
  D.showNumber = () => form(true); window.__dpNumber = () => form(true);
}
