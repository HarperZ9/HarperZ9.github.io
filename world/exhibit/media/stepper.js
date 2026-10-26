// media/stepper.js: a stepped explainer. One small wireframe isometric diagram changes state across numbered steps (02/07, with arrows),
// on a dark card that floats over a painting or an archival collage. The pattern is the one taught in Maxime Heckel's lighting explainer; code is our own.
// createStepper(host, { backdrop: canvas|img, steps: [{ title, text, draw(g, k, T) }], aria }) where g is the iso helper and T the step transition 0..1.
import { apply, byId, mk, pointer } from './index.js';

export function iso(ctx, W, H, scale = 1) {
  const s = Math.min(W, H) / 11 * scale, ox = W / 2, oy = H * .74;
  const P = (x, y, z) => [ox + (x - y) * s * .866, oy + (x + y) * s * .5 - z * s];
  const g = { ctx, P, s };
  g.line = (a, b, col = '#eee9df', w = 2) => { const [x1, y1] = P(...a), [x2, y2] = P(...b); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  g.poly = (pts, col = '#eee9df', fill = null, w = 2) => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = P(...p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
  g.box = (x, y, z, w, d, h, col = '#eee9df', fill = 'rgba(17,17,17,.82)') => { // wireframe box with a dark filled top and sides, back edges dashed
    const A = [x, y, z], B = [x + w, y, z], C = [x + w, y + d, z], D = [x, y + d, z], A2 = [x, y, z + h], B2 = [x + w, y, z + h], C2 = [x + w, y + d, z + h], D2 = [x, y + d, z + h];
    g.poly([B, C, C2, B2], col, fill); g.poly([D, C, C2, D2], col, fill); g.poly([A2, B2, C2, D2], col, fill); };
  g.circle = (x, y, z, r, col = '#eee9df', fill = null, w = 2) => { ctx.beginPath(); for (let i = 0; i <= 28; i++) { const a = i / 28 * 6.2832, [px, py] = P(x + Math.cos(a) * r, y + Math.sin(a) * r, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
  g.text = (str, x, y, z, size = 16, col = '#eee9df', align = 'center') => { const [px, py] = P(x, y, z); ctx.fillStyle = col; ctx.font = `700 ${size}px "Hanken Grotesk",sans-serif`; ctx.textAlign = align; ctx.fillText(str, px, py); };
  g.grid = (n = 6, step = 1, col = 'rgba(238,233,223,.18)') => { for (let i = -n; i <= n; i++) { g.line([i * step, -n * step, 0], [i * step, n * step, 0], col, 1); g.line([-n * step, i * step, 0], [n * step, i * step, 0], col, 1); } };
  return g;
}

export function createStepper(host, o) {
  const N = o.steps.length, pad = n => String(n).padStart(2, '0'); let k = 0, T = 1, t0 = performance.now(), raf = 0;
  host.classList.add('stepper'); host.innerHTML = `<canvas class="st-back" aria-hidden="true"></canvas>
  <section class="st-card" tabindex="-1" aria-label="${o.aria || 'Step by step explainer'}"><div class="st-dia"><canvas aria-hidden="true"></canvas><canvas class="st-dots" aria-hidden="true"></canvas></div>
  <div class="st-head"><b class="st-n" aria-hidden="true"></b><h2 class="st-t"></h2></div><p class="st-p" aria-live="polite"></p>
  <div class="st-nav"><button type="button" class="st-prev" aria-label="Previous step">←</button><div class="st-bar" aria-hidden="true"></div><button type="button" class="st-next" aria-label="Next step">→</button></div></section>`;
  const $ = s => host.querySelector(s), back = $('.st-back'), card = $('.st-card'), dia = $('.st-dia canvas'), dots = $('.st-dots'), ptr = pointer($('.st-dia'), { keys: card, plain: false });
  const bar = $('.st-bar'); bar.innerHTML = Array.from({ length: N }, () => '<i></i>').join('');
  const drawBack = () => { const r = host.getBoundingClientRect(); back.width = Math.round(r.width); back.height = Math.round(r.height); const x = back.getContext('2d'); x.fillStyle = '#10243a'; x.fillRect(0, 0, back.width, back.height);
    const b = o.backdrop; if (b) { const s = Math.max(back.width / (b.width || b.naturalWidth), back.height / (b.height || b.naturalHeight)), w = (b.width || b.naturalWidth) * s, h = (b.height || b.naturalHeight) * s; x.drawImage(b, (back.width - w) / 2, (back.height - h) / 2, w, h); } };
  const size = () => { const r = $('.st-dia').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); for (const c of [dia, dots]) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } };
  const set = (n, instant) => { k = Math.max(0, Math.min(N - 1, n)); T = instant ? 1 : 0; t0 = performance.now(); const s = o.steps[k]; $('.st-n').textContent = `${pad(k + 1)}/${pad(N)}`; $('.st-t').textContent = s.title; $('.st-p').textContent = s.text;
    bar.querySelectorAll('i').forEach((e, i) => e.classList.toggle('on', i <= k)); $('.st-prev').disabled = k === 0; $('.st-next').disabled = k === N - 1; kick(); };
  const draw = now => { raf = 0; T = Math.min(1, (now - t0) / 650); const e = T * T * (3 - 2 * T); ptr.update(.016); const x = dia.getContext('2d'); x.clearRect(0, 0, dia.width, dia.height); const g = iso(x, dia.width, dia.height, o.scale || 1); x.lineJoin = 'round'; x.lineCap = 'round'; o.steps[k].draw(g, k, e, now / 1000);
    if (ptr.f > .02) { apply(dia, [[byId.dotfield, { mode: 0, mix: 0, invert: 0, thresh: .12, size: 1.3, only: 1, ptr: ptr.arr(), pr: .22, count: 16000 }]], dots, { t: now / 1000 }); } else dots.getContext('2d').clearRect(0, 0, dots.width, dots.height);
    if (T < 1 || ptr.f > .01 || ptr.tf) raf = requestAnimationFrame(draw); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
  ['pointermove', 'pointerdown'].forEach(ev => $('.st-dia').addEventListener(ev, kick));
  $('.st-prev').onclick = () => set(k - 1); $('.st-next').onclick = () => set(k + 1);
  host.addEventListener('keydown', e => { if (e.shiftKey || e.altKey) { kick(); return; } if (e.key === 'ArrowRight') { set(k + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { set(k - 1); e.preventDefault(); } });
  addEventListener('resize', () => { drawBack(); size(); kick(); });
  drawBack(); size(); set(0, true); return { set, redraw: () => { drawBack(); kick(); }, get step() { return k; } };
}
