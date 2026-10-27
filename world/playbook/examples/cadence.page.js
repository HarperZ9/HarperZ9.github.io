// Weather, on twos: three clocks on one picture.
//   layout  'shot'     the framing cuts to a new crop every 0.9 to 1.4 s, the edited-shot length of QUALITY-SPEC M7
//                      (Hf9W 0.91 s, 2j7Q 1.61 s); a faster recut of one bright picture would flash
//   texture 'twos-24'  the engraving boils: three drawings of the same cloud, each laid by the burin from a slightly
//                      perturbed tone field, swapped 12 times a second
//   display (ones)     inside each framing the camera drifts, linear, every display frame
// Source: a 1962 NASA photograph of cumulus over the West Atlantic (public domain, open-archives receipt
// run-20261024-004525-playbook-mosaic-clouds), engraved by the techniques lib's burin. The exposure sheet along the foot
// is cadence.js drawing its own clocks, with the playhead.
import { Cadence, run, clock } from '../cadence.js';
import { hash01, reducedMotion } from '../lib/util.js';
import { context2d, grainTile, applyGrain } from '../../substrate/lib/raster.mjs';

const INK = '#15130f', PAPER = '#efe8d8', HOT = '#8f3a19', RM = reducedMotion(), V = 3, WORK = 760;
const GRAIN = Array.from({ length: 6 }, (_, i) => grainTile({ size: 256, sd: 1.4, clump: 2, seed: 60 + i }));
const art = document.getElementById('art'), sheet = document.getElementById('sheet'), stage = document.getElementById('stage');
let WH = 0, ctx, sctx, W = 0, H = 0, DPR = 1, frame = { k: 0, boil: 0 };

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('cadence: plate failed ' + src)); i.src = src; });

function lumaOf(img, w, h) {
  const c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
  for (let i = 0; i < L.length; i++) L[i] = Math.min(1, (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255 * 1.08);
  return L;
}

// Each shot is drawn at device resolution from the vector strokes, so lines stay crisp at any crop (R3). The worker
// draws it (OffscreenCanvas, only the strokes inside the window) and hands back an ImageBitmap, so a shot costs the
// main thread one drawImage. Shots for the next framing are requested during the current one (k is pure).
const M = 0.06, cache = new Map(), pending = new Set(), ready = new Set();
let wk = null;
function shotGeom(k) { const f = framing(k), A = W / H; let cw = WORK * f.z, ch = cw / A; if (ch > WH * f.z) { ch = WH * f.z; cw = ch * A; } return { ...f, cw, ch, sx: f.u * (WORK - cw), sy: f.v * (WH - ch) }; }
function request(k, i) {
  const key = `${k}:${i}`; if (cache.has(key) || pending.has(key) || !ready.has(i) || pending.size >= 2) return;
  const g = shotGeom(k), scale = art.width / g.cw, mx = (M * art.width) / scale, my = (M * art.height) / scale;
  pending.add(key); wk.postMessage({ type: 'shot', key, id: i, sx: g.sx - mx, sy: g.sy - my, cw: g.cw + 2 * mx, ch: g.ch + 2 * my, scale, W: Math.ceil(art.width * (1 + 2 * M)), H: Math.ceil(art.height * (1 + 2 * M)) });
}
function prepare(k) {
  for (let i = 0; i < V; i++) request(k, i);
  if (!RM) for (let i = 0; i < V; i++) request(k + 1, i);
  for (const [key, bm] of cache) { const kk = +key.split(':')[0]; if (kk < k || kk > k + 1) { bm.close?.(); cache.delete(key); } }
}
function engraveAll(L, w, h) {
  wk = new Worker(new URL('./cadence.worker.js', import.meta.url), { type: 'module' });
  wk.onerror = (e) => console.error('cadence: engraving worker failed', e.message || e.type);
  wk.onmessage = (e) => {
    const d = e.data; if (d.type === 'error') { console.error('cadence: worker', d.error); return; }
    if (d.type === 'ready') { ready.add(d.id); prepare(frame.k); }
    if (d.type === 'shot') { pending.delete(d.key); cache.set(d.key, d.bitmap); prepare(frame.k); if (RM) paint(4, 0.5); }
  };
  for (let i = 0; i < V; i++) wk.postMessage({ type: 'engrave', id: i, luma: L, w, h, dsep: 4.2, jitter: 0.06, seed: 17 + i * 101 });
}

// The framing for layout state k: a crop window 34% to 62% of the plate, and a drift direction for the display clock.
function framing(k) { const z = 0.34 + 0.28 * hash01(91, k); return { z, u: hash01(92, k) * (1 - z), v: hash01(93, k) * (1 - z), du: (hash01(94, k) - 0.5) * 0.03, dv: (hash01(95, k) - 0.5) * 0.02 }; }

function paint(t = performance.now() / 1000, local = 0) {
  if (!wk) return; prepare(frame.k);
  let d = cache.get(`${frame.k}:${frame.boil % V}`); for (let i = 0; !d && i < V; i++) d = cache.get(`${frame.k}:${i}`);
  if (d) {
    const g = shotGeom(frame.k), s = art.width / g.cw;
    const ox = Math.max(-M * art.width, Math.min(M * art.width, g.du * local * WORK * s)), oy = Math.max(-M * art.height, Math.min(M * art.height, g.dv * local * WH * s));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(d, -M * art.width - ox, -M * art.height - oy);
    applyGrain(ctx, art.width, art.height, GRAIN[frame.boil % GRAIN.length]); // paper grain boils with the drawing (R4)
  }
  drawSheet(t);
}

const SHOT = { id: 'shot', fps: 25, holds: [30, 22, 36, 28, 24, 34] };
const ROWS = [['shot', SHOT], ['twos-24', 'twos-24'], ['ones-60', 'ones-60']], CLOCKS = ROWS.map(([, def]) => clock(def, { seed: 1 }));
function drawSheet(t) {
  const w = sheet.width, h = sheet.height, s = DPR, rowH = h / ROWS.length, span = 2, x0 = 132 * s;
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.fillStyle = INK; sctx.fillRect(0, 0, w, h); sctx.font = `400 ${13 * s}px Conso, ui-monospace, monospace`; sctx.textBaseline = 'middle';
  const t0 = Math.max(0, t - span / 2), fps = 60, cell = (w - x0 - 12 * s) / (span * fps);
  ROWS.forEach(([id, def], r) => {
    const ck = CLOCKS[r], y = r * rowH; sctx.fillStyle = PAPER; sctx.fillText(id, 12 * s, y + rowH / 2);
    let prev = -1, band = 0;
    for (let i = 0; i < span * fps; i++) {
      const k = ck.indexAt(t0 + i / fps); if (k !== prev) { band ^= 1; prev = k; }
      sctx.fillStyle = band ? PAPER : '#8a8478'; sctx.fillRect(x0 + i * cell, y + rowH * 0.3, Math.max(1, cell - (ck.indexAt(t0 + (i + 1) / fps) !== k ? s : 0)), rowH * 0.4);
    }
  });
  const px = x0 + ((t - t0) * fps) * cell; sctx.fillStyle = HOT; sctx.fillRect(Math.round(px), 0, 2 * s, h);
}

function size() {
  DPR = Math.max(1, devicePixelRatio || 1); const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
  art.width = Math.round(W * DPR); art.height = Math.round(H * DPR);
  const sr = sheet.getBoundingClientRect(); sheet.width = Math.round(sr.width * DPR); sheet.height = Math.round(sr.height * DPR);
}

async function main() {
  const img = await load(new URL('plates/wikimedia_commons-Cumulus-cloud-formatio.jpg', import.meta.url)); const h = Math.round(WORK * img.naturalHeight / img.naturalWidth); WH = h;
  ctx = context2d(art); sctx = context2d(sheet); size(); addEventListener('resize', () => { size(); for (const bm of cache.values()) bm.close?.(); cache.clear(); paint(); });
  engraveAll(lumaOf(img, WORK, h), WORK, h);
  const cad = new Cadence({ clocks: { layout: SHOT, texture: 'twos-24' }, seed: 1 });
  cad.subscribe({ layout: 'layout', texture: 'texture', onLayout(st) { frame.k = st.index; }, onTexture(st) { frame.boil = st.index; }, draw(fr) { paint(fr.t, fr.clocks.layout.local); } });
  if (RM) { frame = { k: 3, boil: 0 }; cad.seek(4); paint(4, 0.5); } else run(cad);
}
main().catch((e) => console.error('cadence: page failed to start', e));
