// Scatter: mosaic.js on the cadence clocks, filled with cleared archival plates and our own generators.
// Layout on recut-3.6 (a new grid every 7 frames at 25 fps); grain boil on boil-12 (substrate grainTile and applyGrain).
// Generators in the tiles: phyllotaxis seed heads and Chladni sand from morphcloud's targets, and the studio's
// engraving plate rendered off the main thread. Plates: NASA and NOAA orbital weather photographs (public domain) and
// Met open-access botanical prints (CC0), gathered with open-archives receipts (examples/plates/plates.json).
import { layout, INKS, shade, isolines } from '../mosaic.js';
import { Cadence, run } from '../cadence.js';
import { phyllotaxis, plate as chladni } from '../lib/morphcloud-targets.js';
import { mixOk, reducedMotion } from '../lib/util.js';
import { grainTile, applyGrain, context2d } from '../../substrate/lib/raster.mjs';

const art = document.getElementById('art'), stage = document.getElementById('stage');
const RM = reducedMotion(), SEED = 1023;
let W = 0, H = 0, DPR = 1, ctx = null, comp = null, comp2 = null, L = null;
const plates = [], gens = [], grains = [];
let dates = '';

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error('mosaic: plate failed ' + src)); i.src = src; });
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, w | 0), height: Math.max(1, h | 0) });

// Generator sources: drawn once at load into canvases the tiles crop from.
function seedHead(n, angle, ink, ground) {
  const c = canvas(900, 900), x = c.getContext('2d'), t = phyllotaxis({ angleDeg: angle, fit: 0.94 })(n, { w: 900, h: 900 });
  x.fillStyle = ground; x.fillRect(0, 0, 900, 900); x.fillStyle = ink;
  for (let j = 0; j < n; j++) { const r = 1.2 + 6.5 * Math.sqrt(j / n); x.beginPath(); x.arc(t.pts[2 * j], t.pts[2 * j + 1], r, 0, 6.2832); x.fill(); }
  return c;
}
function sand(m, k, ink, ground) {
  const c = canvas(900, 900), x = c.getContext('2d'), t = chladni({ m, n: k, fit: 1 })(26000, { w: 900, h: 900, seed: m * 31 + k, cell: 3.2 });
  x.fillStyle = ground; x.fillRect(0, 0, 900, 900); x.fillStyle = ink;
  for (let j = 0; j < 26000; j++) x.fillRect(t.pts[2 * j] - 0.75, t.pts[2 * j + 1] - 0.75, 1.5, 1.5);
  return c;
}
function studioPlate(material, w, h) {
  return new Promise((res) => {
    const wk = new Worker(new URL('../lib/captionline-plates-worker.js', import.meta.url), { type: 'module' });
    wk.onmessage = (e) => { wk.terminate(); if (e.data.error) { console.error('mosaic: studio plate', e.data.error); return res(null); } const c = canvas(e.data.w, e.data.h); c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(e.data.buf), e.data.w, e.data.h), 0, 0); res(c); };
    wk.onerror = (e) => { console.error('mosaic: studio worker failed', e.message || e.type); wk.terminate(); res(null); };
    wk.postMessage({ id: material, material, w, h, seed: 7 });
  });
}

// Draw source s into tile t, cropped by t.crop (u, v pick the window, s zooms in up to 3.2x).
function cover(x, src, t) {
  const sw = src.width, sh = src.height, ta = t.w / t.h; let cw = sw / t.crop.s, ch = cw / ta;
  if (ch > sh / t.crop.s) { ch = sh / t.crop.s; cw = ch * ta; }
  x.drawImage(src, t.crop.u * (sw - cw), t.crop.v * (sh - ch), cw, ch, t.x, t.y, t.w, t.h);
}

const PAINT = {
  plate(x, t) { cover(x, plates[t.src % plates.length].img, t); },
  duo(x, t) {
    x.save(); x.beginPath(); x.rect(t.x, t.y, t.w, t.h); x.clip(); x.filter = 'grayscale(1) contrast(1.2)'; cover(x, plates[t.src % plates.length].img, t); x.filter = 'none';
    x.globalCompositeOperation = 'multiply'; x.fillStyle = t.accent ? INKS.hot : t.ink; x.fillRect(t.x, t.y, t.w, t.h); x.restore();
  },
  field(x, t) {
    const g = x.createRadialGradient(t.x + t.crop.u * t.w, t.y + t.crop.v * t.h, 0, t.x + t.crop.u * t.w, t.y + t.crop.v * t.h, Math.hypot(t.w, t.h) * 0.9);
    g.addColorStop(0, t.accent ? INKS.hot : t.ink); g.addColorStop(1, mixOk(t.ink2, INKS.ground, 0.55)); x.fillStyle = g; x.fillRect(t.x, t.y, t.w, t.h);
  },
  dots(x, t) {
    x.fillStyle = INKS.ground; x.fillRect(t.x, t.y, t.w, t.h); x.fillStyle = t.accent ? INKS.hot : t.ink; const p = 9;
    x.beginPath();
    for (let y = t.y + p / 2; y < t.y + t.h; y += p) for (let X = t.x + p / 2; X < t.x + t.w; X += p) {
      const v = shade((X - t.x) / t.w + t.crop.u, (y - t.y) / t.h + t.crop.v, t.crop.s); if (v > 0.18) { const r = 0.5 + 3.4 * v * v; x.moveTo(X + r, y); x.arc(X, y, r, 0, 6.2832); }
    }
    x.fill();
  },
  contour(x, t) {
    x.fillStyle = mixOk(t.ink2, INKS.ground, 0.82); x.fillRect(t.x, t.y, t.w, t.h); const s = isolines(t, { N: 9, step: 3 });
    x.strokeStyle = t.accent ? INKS.hot : t.ink; x.lineWidth = 1; x.lineCap = 'round'; x.beginPath();
    for (let i = 0; i < s.length; i += 4) { x.moveTo(s[i], s[i + 1]); x.lineTo(s[i + 2], s[i + 3]); }
    x.stroke();
  },
  digits(x, t) {
    x.fillStyle = mixOk(t.ink, INKS.ground, 0.88); x.fillRect(t.x, t.y, t.w, t.h);
    const size = Math.max(13, Math.min(22, t.w / 6)); x.font = `500 ${size}px Conso, ui-monospace, monospace`; x.fillStyle = t.accent ? INKS.hot : t.ink; x.textBaseline = 'top';
    const cols = Math.max(1, Math.floor((t.w - 8) / (size * 2.9))), off = Math.floor(t.crop.u * dates.length);
    for (let c = 0; c < cols; c++) for (let r = 0, y = t.y + 8; y + size < t.y + t.h - 4; r++, y += size * 1.12) {
      const k = (off + Math.floor(Math.abs(Math.sin((c + 1) * 91.7 + r * 12.3 + t.seed)) * 1e4) * 4) % (dates.length - 4); x.fillText(dates.slice(k, k + 4), t.x + 8 + c * size * 2.9, y);
    }
  },
  flat(x, t) { x.fillStyle = t.accent ? INKS.hot : t.ink; x.fillRect(t.x, t.y, t.w, t.h); },
  gen(x, t) { const g = gens[t.src % gens.length]; if (g) cover(x, g, t); else PAINT.field(x, t); },
};

// Composition is a job of small steps (one tile each, then gutters and labels), so the next layout can be drawn into
// a back buffer a few milliseconds per frame during the current hold; at the cut the buffers swap (M1, M2).
function job(k, target) {
  const x = context2d(target), Lk = layout(SEED, k, W, H, { module: Math.max(40, W / 9), sources: { plate: plates.length, gen: gens.length }, labelShare: 0.5 });
  const steps = [() => { x.setTransform(DPR, 0, 0, DPR, 0, 0); x.fillStyle = INKS.ground; x.fillRect(0, 0, W, H); }];
  for (const t of Lk.tiles) steps.push(() => { x.save(); x.beginPath(); x.rect(t.x, t.y, t.w, t.h); x.clip(); PAINT[t.cls](x, t); x.restore(); });
  steps.push(() => {
    x.fillStyle = INKS.ground; for (const t of Lk.tiles) { x.fillRect(t.x, t.y, t.w, 1); x.fillRect(t.x, t.y, 1, t.h); }
    x.font = '400 13px Conso, ui-monospace, monospace'; x.textBaseline = 'top';
    for (const t of Lk.tiles) if (t.label && t.w > 48 && t.h > 30) { const wv = x.measureText(t.label).width; x.fillStyle = INKS.ground; x.fillRect(t.x + 1, t.y + 1, wv + 10, 20); x.fillStyle = INKS.bone; x.fillText(t.label, t.x + 6, t.y + 5); }
  });
  return { k, L: Lk, target, steps, i: 0, get done() { return this.i >= this.steps.length; } };
}
function work(j, ms = Infinity) { const t0 = performance.now(); while (!j.done && performance.now() - t0 < ms) j.steps[j.i++](); return j; }
let back = null;
function compose(k) {
  if (!back || back.k !== k || back.target.width !== art.width || back.target.height !== art.height) back = job(k, comp2);
  work(back); L = back.L; [comp, comp2] = [back.target, comp]; back = null;
}
function ahead(k) { if (RM) return; if (!back) { if (comp2.width !== art.width || comp2.height !== art.height) { comp2.width = art.width; comp2.height = art.height; } back = job(k, comp2); } if (back.k === k) work(back, 4); }
function present(seed) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(comp, 0, 0);
  applyGrain(ctx, art.width, art.height, grains[seed % grains.length]);
}

function size() {
  const r = stage.getBoundingClientRect(); DPR = Math.max(1, devicePixelRatio || 1); W = Math.round(r.width); H = Math.round(r.height);
  art.width = Math.round(W * DPR); art.height = Math.round(H * DPR); for (const c of [comp, comp2]) { c.width = art.width; c.height = art.height; } back = null;
}

async function main() {
  const meta = await (await fetch(new URL('plates/plates.json', import.meta.url))).json();
  const imgs = await Promise.all(meta.map((m) => load(new URL('plates/' + m.file, import.meta.url))));
  meta.forEach((m, i) => plates.push({ ...m, img: imgs[i] }));
  dates = meta.map((m) => String(m.year) + (m.landing.match(/\d{4,}/g) || []).join('')).join('').replace(/\D/g, '');
  document.getElementById('credits').append(...meta.map((m) => { const li = document.createElement('li'), a = document.createElement('a'); a.href = m.landing; a.textContent = `${m.creator && m.creator.length < 40 ? m.creator + ', ' : ''}${m.year}`; a.title = m.title; li.append(a); return li; }));
  gens.push(seedHead(2600, 137.508, INKS.ochre, '#16130e'), sand(3, 5, INKS.sand, '#1b2230'), seedHead(1800, 137.3, INKS.sky, '#0d1418'), sand(2, 7, INKS.bone, '#121211'));
  for (let i = 0; i < 6; i++) grains.push(grainTile({ size: 256, sd: 1.5, clump: 2, seed: 40 + i }));
  ctx = context2d(art); comp = canvas(2, 2); comp2 = canvas(2, 2); size();
  const cad = new Cadence({ clocks: { layout: 'recut-3.6', texture: 'boil-12' }, seed: SEED });
  let boil = 0;
  cad.subscribe({ layout: 'layout', texture: 'texture', onLayout(st) { compose(st.index); present(boil); }, onTexture(st) { boil = st.seed; present(boil); }, draw(fr) { ahead(fr.clocks.layout.index + 1); } });
  addEventListener('resize', () => { size(); compose(L ? L.k : 0); present(boil); });
  if (RM) { compose(5); present(0); } else run(cad);
  studioPlate('engraving', 1200, 800).then((c) => { if (c) gens.push(c); });
}
main().catch((e) => console.error('mosaic: page failed to start', e));
