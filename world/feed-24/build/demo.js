// demo.js: the construction plate and the Hamming field rooms, plus the lettering hook.
import { scene, renderBase, renderLive, leaders, placeLabels, glyphGrid, leaderEnd, mask, trackedAt, headAt } from './construct.js';
import { toRGB16, encodePNG16, deflateBrowser } from './png16.js';
import { spiralAt } from './golden.js';
import { surface, toRGBA, hexLin } from './raster.js';
import { wordMatrix } from './hamming.js';
import { tiles, render as mosaic, DEFAULTS as MOSAIC } from './bitmosaic.js';
import { letter } from './lettering24.js';

const root = document.documentElement, RM = matchMedia('(prefers-reduced-motion: reduce)');
const dprOf = () => Math.min(3, window.devicePixelRatio || 1);
// QUALITY-SPEC R5: a display-p3 backing store. Pixels are computed in sRGB and every ImageData is tagged
// srgb, so the browser converts on put: exact on sRGB screens, nothing oversaturated on wide-gamut ones.
export const SPACE = 'display-p3';
const ctx2d = c => c.getContext('2d', { colorSpace: SPACE });
const img = (data, w, h) => new ImageData(data, w, h, { colorSpace: 'srgb' });
const plain = () => root.classList.contains('plain');
const visible = new WeakMap(), io = new IntersectionObserver(es => es.forEach(e => visible.set(e.target, e.isIntersecting)));
window.UIShell?.registerLettering ? window.UIShell.registerLettering(letter) : addEventListener('load', () => window.UIShell?.registerLettering(letter));

// A word as a coverage mask: set it in Hanken Grotesk at 4x the cell grid and average 4 x 4 blocks.
async function textMask(text, rows = 15) {
  await document.fonts.load('800 64px "Hanken Grotesk"');
  const k = 4, px = rows * k, c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  g.font = `800 ${px}px "Hanken Grotesk"`; const m = g.measureText(text), wpx = Math.ceil(m.width + px * 0.1);
  c.width = Math.ceil(wpx / k) * k; c.height = Math.ceil(px * 1.12 / k) * k;
  g.font = `800 ${px}px "Hanken Grotesk"`; g.textBaseline = 'alphabetic'; g.fillText(text, px * 0.05, px * 0.86);
  const d = g.getImageData(0, 0, c.width, c.height).data, cols = c.width / k, rr = c.height / k;
  return mask(cols, rr, (i, j) => { let s = 0; for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) s += d[4 * ((j * k + y) * c.width + i * k + x) + 3]; return s / (255 * k * k); });
}

// The moving layer of the plate (head, tail, tracked boxes, leaders, labels), drawn with Canvas 2D from
// the tested geometry. k is device pixels per CSS pixel for label size. Returns the head position u.
function paintLive(g, sc, base, t, law, k) {
  const W = sc.W, H = sc.H, lw = Math.max(1, W / 900), u = headAt({ ...sc, c: { ...sc.c, law } }, t), ink = sc.c.ink, acc = sc.c.accent, N = 90, tail = sc.c.tail;
  g.globalAlpha = 1; g.drawImage(base, 0, 0);
  if (u < sc.g.squares.length - 0.01) {
    g.lineCap = 'round'; g.strokeStyle = ink; let prev = spiralAt(sc.g, Math.max(0, u - tail));
    for (let i = 1; i <= N; i++) { const f = i / N, p = spiralAt(sc.g, Math.max(0, u - tail * (1 - f))); g.globalAlpha = f * f; g.lineWidth = lw * (1.4 + 2.2 * f); g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(p.x, p.y); g.stroke(); prev = p; }
    const hd = spiralAt(sc.g, u), R = 22 * lw, rg = g.createRadialGradient(hd.x, hd.y, 0, hd.x, hd.y, R);
    rg.addColorStop(0, '#fff8ec'); rg.addColorStop(0.16, acc); rg.addColorStop(1, 'rgba(227,155,58,0)');
    g.globalAlpha = 1; g.globalCompositeOperation = 'lighter'; g.fillStyle = rg; g.beginPath(); g.arc(hd.x, hd.y, R, 0, 2 * Math.PI); g.fill(); g.globalCompositeOperation = 'source-over';
  }
  sc.avoid ??= glyphGrid(sc.cells, W, H, { step: Math.max(4, Math.round(3 * k)), pad: 3 * k });   // the letters, cached per scene
  sc.centre ??= (() => { let x = 0, y = 0, n = 0; for (const c of sc.cells) if (c.fig >= 0) { x += c.x; y += c.y; n++; } return { x: x / (n || 1), y: y / (n || 1) }; })();
  const tracked = trackedAt(sc, t), font = Math.round(Math.max(9, Math.min(11.5, W / k / 62)) * k), placed = placeLabels(tracked, 0, { W, H, font, gap: 9 * k, avoid: sc.avoid, centre: sc.centre });
  g.globalAlpha = 0.95; g.strokeStyle = acc; g.lineWidth = lw;
  for (const p of tracked) g.strokeRect(p.x - 4 * lw, p.y - 4 * lw, 8 * lw, 8 * lw);
  g.font = `400 ${font}px Conso, monospace`; g.textBaseline = 'top';
  for (const p of placed) {
    const b = p.box, e = leaderEnd(p, b), wl = 0.8 * lw;
    // QUALITY-SPEC R3b: never a sub-pixel stroke; a thinner line is 1 px with its alpha scaled by width
    g.globalAlpha = 0.5 * Math.min(1, wl); g.strokeStyle = ink; g.lineWidth = Math.max(1, wl); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(e.x, e.y); g.stroke();
    g.globalAlpha = 0.72; g.fillStyle = sc.c.ground; g.fillRect(b.x, b.y, b.w, b.h);   // a quiet plate so digits read over cells
    g.globalAlpha = 1; g.fillStyle = ink; g.fillText(p.text, b.x + 2, b.y + 2);
  }
  g.globalAlpha = 1;
  return u;
}

export function saveCanvas(c, name) {
  return new Promise((res, rej) => c.toBlob(b => {
    if (!b) { rej(new Error('toBlob returned nothing')); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); res();
  }, 'image/png'));
}

// ---------- Room 1: the construction plate ----------
// The static plate is rendered once per size or word by construct.renderBase (the tested raster); the
// head, its tail, the tracked boxes, leaders and labels are drawn per frame with Canvas 2D from the
// same geometry (golden.spiralAt, construct.trackedAt), so the moving parts cost little.
function plateRoom() {
  const cv = document.getElementById('plate'); if (!cv) return;
  const input = document.getElementById('plate-word'), base = document.createElement('canvas');
  let sc = null, W = 0, H = 0, dpr = 1, law = 'angle', t0 = performance.now(), tFix = 1.65 * 2.4, word = input.value.trim() || 'insight', job = 0;
  io.observe(cv);
  const now = () => (RM.matches ? tFix : (performance.now() - t0) / 1000);
  async function build() {
    const my = ++job; dpr = dprOf();
    const css = cv.getBoundingClientRect(), w = Math.round(css.width * dpr), h = Math.round(css.width * 2 / 3 * dpr);
    await document.fonts.load(`400 ${Math.round(11.5 * dpr)}px Conso`);
    const figs = [{ mask: await textMask(word), square: 0, scale: 0.9 }, { mask: await textMask('1962', 13), square: 1, scale: 0.62 }];
    if (my !== job) return;
    const s = scene(w, h, figs, 0, { law, pitch: 0.0105, tracked: css.width < 520 ? 5 : 9 }), S = renderBase(surface(w, h, hexLin(s.c.ground)), s);
    W = w; H = h; cv.width = W; cv.height = H; base.width = W; base.height = H;
    ctx2d(base).putImageData(img(toRGBA(S), W, H), 0, 0);
    sc = s; draw(now());
  }
  function draw(t) {
    if (!sc) return;
    paintLive(ctx2d(cv), sc, base, t, law, dpr);
  }
  // QUALITY-SPEC O1: a still at 3840 px on the long side, rendered offscreen at that size (never upscaled).
  document.getElementById('plate-save')?.addEventListener('click', async e => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Rendering 3840 px';
    try {
      const w = 3840, h = 2560, k = w / (W || w), figs = [{ mask: await textMask(word), square: 0, scale: 0.9 }, { mask: await textMask('1962', 13), square: 1, scale: 0.62 }];
      const s = scene(w, h, figs, 0, { law, pitch: 0.0105, tracked: sc?.c.tracked ?? 9 }), S = renderBase(surface(w, h, hexLin(s.c.ground)), s);
      const big = document.createElement('canvas'), bb = document.createElement('canvas'); big.width = bb.width = w; big.height = bb.height = h;
      ctx2d(bb).putImageData(img(toRGBA(S), w, h), 0, 0);
      paintLive(ctx2d(big), s, bb, now(), law, dpr * k);
      await saveCanvas(big, `construction-plate-${word}-3840.png`);
    } catch (err) { console.error('plate export failed', err); }
    btn.disabled = false; btn.textContent = 'Save a 3840 px still';
  });
  // QUALITY-SPEC O1: the plate renders in linear float, so it also exports 16 bits per channel. Everything is
  // drawn into the float surface: base, head and tail, tracked boxes, leaders; the label digits come from a
  // canvas coverage mask composited in linear light, so the file is the whole plate, not the plate minus text.
  document.getElementById('plate-save16')?.addEventListener('click', async e => {
    const btn = e.currentTarget, label = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering 16-bit';
    try {
      const w = 3840, h = 2560, k = w / ((W / dpr) || 1440), figs = [{ mask: await textMask(word), square: 0, scale: 0.9 }, { mask: await textMask('1962', 13), square: 1, scale: 0.62 }];
      const s = scene(w, h, figs, now(), { law, pitch: 0.0105, tracked: sc?.c.tracked ?? 9 }), S = renderBase(surface(w, h, hexLin(s.c.ground)), s);
      renderLive(S, s);
      const font = Math.round(Math.max(9, Math.min(11.5, w / k / 62)) * k);
      const avoid = glyphGrid(s.cells, w, h, { step: Math.max(4, Math.round(3 * k)), pad: 3 * k });
      const placed = placeLabels(s.tracked, 0, { W: w, H: h, font, gap: 9 * k, avoid });
      leaders(S, placed, s);
      const m = document.createElement('canvas'); m.width = w; m.height = h; const mg = m.getContext('2d');
      mg.font = `400 ${font}px Conso, monospace`; mg.textBaseline = 'top'; mg.fillStyle = '#fff';
      for (const p of placed) mg.fillText(p.text, p.box.x + 2, p.box.y + 2);
      const cov = mg.getImageData(0, 0, w, h).data, ground = hexLin(s.c.ground), ink = hexLin(s.c.ink);
      for (const p of placed) {                                    // the quiet label plate, 72% ground
        const b = p.box; for (let y = Math.max(0, b.y | 0); y < Math.min(h, b.y + b.h); y++) for (let x = Math.max(0, b.x | 0); x < Math.min(w, b.x + b.w); x++) for (let c = 0; c < 3; c++) { const i = 3 * (y * w + x) + c; S.px[i] += (ground[c] - S.px[i]) * 0.72; }
      }
      for (let i = 0; i < w * h; i++) { const a = cov[4 * i + 3] / 255; if (a) for (let c = 0; c < 3; c++) S.px[3 * i + c] += (ink[c] - S.px[3 * i + c]) * a; }
      const png = await encodePNG16(toRGB16(S), w, h, deflateBrowser);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([png], { type: 'image/png' })); a.download = `construction-plate-${word}-3840-16bit.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { console.error('16-bit plate export failed', err); }
    btn.disabled = false; btn.textContent = label;
  });
  function loop() {
    if (sc && !RM.matches && !plain() && visible.get(cv) !== false && !document.hidden) draw(now());
    requestAnimationFrame(loop);
  }
  input.addEventListener('change', () => { word = input.value.trim().slice(0, 14) || 'insight'; build(); });
  for (const b of document.querySelectorAll('[data-law]')) b.addEventListener('click', () => {
    law = b.dataset.law; document.querySelectorAll('[data-law]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); t0 = performance.now(); draw(now());
  });
  document.getElementById('plate-step')?.addEventListener('click', () => { tFix = (tFix + 1.65) % (1.65 * 6 + 0.9); draw(tFix); });
  let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 160); }).observe(cv.parentElement);
  requestAnimationFrame(loop);
}

// ---------- Room 3: letters made of bit distances ----------
// The word is set in Hanken Grotesk 900 at the canvas's device size; every 9 CSS px tile shrinks with the
// bits in which (column + the letter's code) and row differ (bitmosaic.js). Pointing reads one tile.
function bitsRoom() {
  const cv = document.getElementById('ham'); if (!cv) return;
  const out = document.getElementById('ham-io'), input = document.getElementById('bits-word');
  let word = input?.value.trim() || 'numbers', W = 0, H = 0, dpr = 1, list = [], pitch = 9;
  async function wordMask(w, h) {
    await document.fonts.load('900 100px "Hanken Grotesk"');
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); let size = h * 0.78;
    g.font = `900 ${size}px "Hanken Grotesk"`; const m = g.measureText(word); size = Math.min(size, size * (w * 0.9) / m.width);
    g.font = `900 ${size}px "Hanken Grotesk"`; g.textBaseline = 'alphabetic';
    const total = g.measureText(word).width, x0 = (w - total) / 2, base = h / 2 + size * 0.36, spans = [];
    let x = x0; for (const ch of word) { const cw = g.measureText(ch).width; spans.push({ x0: x, x1: x + cw, code: ch.charCodeAt(0) }); x += cw; }
    g.fillText(word, x0, base);
    const data = g.getImageData(0, 0, w, h).data, mask = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = data[4 * i + 3] / 255;
    return { mask, spans };
  }
  async function draw() {
    dpr = dprOf(); const r = cv.getBoundingClientRect(); W = Math.round(r.width * dpr); H = Math.round(r.width * 0.5 * dpr);
    const { mask, spans } = await wordMask(W, H);
    list = tiles(W, H, mask, spans, { pitch: pitch * dpr });
    cv.width = W; cv.height = H;
    ctx2d(cv).putImageData(img(toRGBA(mosaic(surface(W, H, hexLin(MOSAIC.ground)), list)), W, H), 0, 0);
    const first = list.find(t => t.inside); if (first) say(first);
  }
  const bin = v => v.toString(2).padStart(8, '0');
  function say(t) {
    const col = (t.i + t.code) & 255, row = t.j & 255, ch = t.code ? String.fromCharCode(t.code).replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`) : '·';
    const r = (k, v, b) => `<code><span class="k">${k}</span><span class="v">${v}</span><span class="b">${b}</span></code>`;
    out.innerHTML = r(ch, `${t.i}+${t.code}`, bin(col)) + r('', t.j, bin(row)) + r('≠', t.h, [...bin(col ^ row)].map(c => (c === '1' ? '<b>1</b>' : '0')).join(''));
  }
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), k = cv.width / r.width, p = pitch * dpr, i = Math.floor((e.clientX - r.left) * k / p), j = Math.floor((e.clientY - r.top) * k / p);
    const t = list.find(q => q.i === i && q.j === j); if (t) say(t);
  });
  input?.addEventListener('change', () => { word = input.value.trim().slice(0, 12) || 'numbers'; draw(); });
  document.getElementById('ham-save')?.addEventListener('click', async () => {   // QUALITY-SPEC O1, rendered at 3840 px
    const w = 3840, h = 1920, k = w / (W || w), { mask, spans } = await wordMask(w, h), big = document.createElement('canvas'); big.width = w; big.height = h;
    ctx2d(big).putImageData(img(toRGBA(mosaic(surface(w, h, hexLin(MOSAIC.ground)), tiles(w, h, mask, spans, { pitch: pitch * dpr * k }))), w, h), 0, 0);
    try { await saveCanvas(big, `bits-${word}-3840.png`); } catch (err) { console.error('bits export failed', err); }
  });
  let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(draw, 120); }).observe(cv.parentElement);
  const tb = document.getElementById('wordm'); if (tb) {
    const a = 'insight', b = 'numbers', m = wordMatrix(a, b);
    tb.innerHTML = `<tr><td></td>${[...b].map(c => `<th scope="col">${c}</th>`).join('')}</tr>` +
      m.map((row, i) => `<tr><th scope="row">${a[i]}</th>${row.map(v => `<td style="--h:${v / 7}">${v}</td>`).join('')}</tr>`).join('');
  }
}

plateRoom(); bitsRoom();
