// lives.js: one factory per kind of life. Each takes its slot element and the Alive instance and returns
// { render(t, ctx), key(t, ctx), rest(), resume(), priority, onDwell? }. key() changes only when the picture would,
// so the governor redraws a 10 Hz wiggle ten times a second, not sixty. The slot keeps its <img>: that still is
// what no-JS, reduced motion and Plain view show (shell ADOPT.md, "The alive layer").
import { clock } from './lib/clock.js';
import { offload } from './lib/offload.js';

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(+v) ? d : +v);
const list = (v) => (v || '').split(/[;|]/).map((r) => r.trim()).filter(Boolean).map((r) => r.split(/[\s,]+/).map(Number));
const dprCap = () => Math.min(devicePixelRatio || 1, 2);
const imgOf = (el) => (el.tagName === 'IMG' ? el : el.querySelector('img'));
async function ready(img) { if (!img.complete || !img.naturalWidth) await new Promise((r, j) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', () => j(new Error('alive: image failed ' + img.src)), { once: true }); }); try { await img.decode(); } catch (e) { /* decoded enough to draw */ } return img; }

// A canvas laid exactly over the slot's <img>, following its size. The <img> stays for alt text and plain view.
function overlay(img, cls) {
  const host = img.parentElement, c = document.createElement('canvas');
  c.className = 'alive-c ' + cls; c.setAttribute('aria-hidden', 'true'); c.dataset.art = '';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.appendChild(c);
  const fit = () => {
    const r = img.getBoundingClientRect(), h = host.getBoundingClientRect(), k = dprCap();
    Object.assign(c.style, { left: r.left - h.left + 'px', top: r.top - h.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const W = Math.max(1, Math.round(r.width * k)), H = Math.max(1, Math.round(r.height * k)); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  };
  fit(); new ResizeObserver(fit).observe(img);
  return c;
}
// The visible part of the natural image under object-fit: cover or contain, as a uv window [x, y, w, h].
function cropOf(img) {
  const fitMode = getComputedStyle(img).objectFit, r = img.getBoundingClientRect(), ar = img.naturalWidth / img.naturalHeight, br = r.width / r.height;
  if (fitMode !== 'cover' || !Number.isFinite(br)) return [0, 0, 1, 1];
  return ar > br ? [(1 - br / ar) / 2, 0, br / ar, 1] : [0, (1 - ar / br) / 2, 1, ar / br];
}
const show = (c, on) => { c.classList.toggle('alive-on', on); };
const pointerIn = (el, p) => { if (!p) return [0, 0]; const r = el.getBoundingClientRect(); return [Math.max(-1, Math.min(1, ((p[0] - r.left) / r.width) * 2 - 1)), Math.max(-1, Math.min(1, ((p[1] - r.top) / r.height) * 2 - 1))]; };

async function livestill(el) {
  const { LiveStill } = await import('./livestill.js'), img = await ready(imgOf(el)), d = el.dataset;
  const c = overlay(img, 'alive-still'), masks = d.mask ? JSON.parse(d.mask) : [];
  const params = { parallax: num(d.parallax, 0.012), breathe: num(d.breathe, 0.004), light: num(d.light, 0.1), wind: num(d.windAmp, 0.004), water: num(d.waterAmp, 0.003), pivot: num(d.pivot, 0.5) };
  const { toImage } = await import('./livestill.js'), small = toImage(img, 320), depth = await offload('../livestill.js', 'estimateDepth', small, { masks });
  const s = new LiveStill(c, img, { params, masks, depth, seed: num(d.seed, 7), wind: d.wind ? { rects: list(d.wind) } : null, water: d.water ? { rects: list(d.water) } : null, work: 320 });
  s.crop = cropOf(img); addEventListener('resize', () => { s.crop = cropOf(img); });
  let ease = [0, 0], flash = null;
  return {
    priority: num(d.priority, 2),
    key: (t) => Math.floor(t * 30),
    render(t, ctx) {
      const p = pointerIn(el, ctx.pointer); ease = ease.map((v, i) => v + (p[i] - v) * 0.06);
      s.pointer = [ease[0], ease[1] + Math.max(-1, Math.min(1, ctx.scroll * 0.02))];
      const k = ctx.level; for (const n of ['parallax', 'wind', 'water', 'light']) s.p[n] = s.base[n] * k;
      s.p.breathe = s.base.breathe * k * (1 + 0.8 * ctx.sound);
      s.lightPhase = flash === null ? null : (t - flash) / 2.4 * 1.6 - 0.3; if (flash !== null && t - flash > 2.4) flash = null;
      if (flash !== null) s.p.light = Math.max(s.p.light, s.base.light * 1.8 || 0.18);
      s.draw(t); show(c, true);
    },
    onDwell() { flash = (window.Alive?.rhythm.t ?? 0); },
    rest() { show(c, false); }, resume() {},
  };
}

async function wiggle(el) {
  const { Wiggle } = await import('./wiggle.js'), d = el.dataset, img = await ready(imgOf(el));
  const c = overlay(img, 'alive-wiggle'), pivot = d.pivot ? d.pivot.split(/[\s,]+/).map(Number) : [0.5, 0.4];
  let source = img;
  if (d.frames) { const { toImage } = await import('./livestill.js'); const ims = await Promise.all(d.frames.split(',').map((u) => { const i = new Image(); i.src = u.trim(); return ready(i); })); source = ims.map((i) => toImage(i, 900)); }
  const depth = Array.isArray(source) ? null : await offload('../livestill.js', 'estimateDepth', (await import('./livestill.js')).toImage(img, 256), {});
  const step = num(d.step, 0.1), w = new Wiggle(c, source, { views: num(d.views, 3), step, amp: num(d.amp, 0.016), order: d.order || 'pingpong', pivot, depth });
  if (w.still) w.still.crop = cropOf(img);
  return {
    priority: num(d.priority, 3),
    key(t, ctx) { w.step = step / (0.5 + 0.5 * ctx.level); return w.index(t); },
    render(t) { w.draw(t); show(c, true); },
    rest() { show(c, false); }, resume() {},
  };
}

// A sequence sheet played as a measured loop on a cadence clock. data-sheet="cols rows", data-row picks one row.
async function loop(el) {
  const L = await import('./loop.js'), { toImage } = await import('./livestill.js'), d = el.dataset, img = await ready(imgOf(el));
  const [cols, rows] = (d.sheet || '8 3').split(/[\s,]+/).map(Number), full = toImage(img, 1600);
  const frames = await offload('../loop.js', 'sheetFrames', full, cols, rows, { row: d.row !== undefined ? +d.row : null, gutter: d.gutter || 'dark' });
  const seq = d.order === 'pingpong' ? L.pingpong(frames.length).map((i) => frames[i]) : frames;
  const c = document.createElement('canvas'); c.className = 'alive-c alive-loop'; c.setAttribute('aria-hidden', 'true'); c.width = seq[0].w; c.height = seq[0].h;
  const host = img.parentElement; host.classList.add('alive-loop-host'); host.appendChild(c);
  const bitmaps = await Promise.all(seq.map((f) => createImageBitmap(new ImageData(f.data, f.w, f.h)))), g = c.getContext('2d');
  // backing store at the host's device size; a cell smaller than that is enlarged in whole pixels, kept crisp
  const fit = () => { const r = host.getBoundingClientRect(), k = dprCap(); c.width = Math.max(seq[0].w, Math.round(r.width * k)); c.height = Math.max(seq[0].h, Math.round(r.height * k)); g.imageSmoothingEnabled = c.width < 2 * seq[0].w; g.imageSmoothingQuality = 'high'; };
  fit(); new ResizeObserver(fit).observe(host);
  const draw = (b) => { const s = Math.min(c.width / b.width, c.height / b.height), w = b.width * s, h = b.height * s; g.clearRect(0, 0, c.width, c.height); g.drawImage(b, (c.width - w) / 2, (c.height - h) / 2, w, h); };
  const ck = clock(d.clock || 'twos-24', { seed: 3 });
  el.dataset.loopFrames = String(seq.length);
  return {
    priority: num(d.priority, 2),
    key: (t, ctx) => ck.at(t * (0.5 + 0.5 * ctx.level)).index % bitmaps.length,
    render(t, ctx) { draw(bitmaps[ck.at(t * (0.5 + 0.5 * ctx.level)).index % bitmaps.length]); host.classList.add('alive-on'); },
    rest() { host.classList.remove('alive-on'); }, resume() {},
  };
}

// A mosaic of code, data or frames. data-source="code:URL" | "series:1,2,3" | "series-url:URL#rows" (data-field, data-label)
// | "sheet" (the slot's own <img> is a sequence sheet, data-sheet="cols rows").
async function framemosaic(el) {
  const M = await import('./framemosaic.js'), d = el.dataset, [kind, ...rest] = (d.source || 'code:./alive.js').split(':'), arg = rest.join(':');
  let src;
  if (kind === 'code') src = M.codeSource(await (await fetch(new URL(arg, document.baseURI))).text(), { linesPerS: num(d.rate, 1.5) });
  else if (kind === 'series') src = M.seriesSource(arg.split(',').map(Number), { unit: d.unit || '' });
  else if (kind === 'series-url') {
    const [u, f] = arg.split('#'), j = await (await fetch(new URL(u, document.baseURI))).json(), rows = f ? j[f] : j, field = d.field || 'value';
    const vals = rows.map((r) => (typeof r === 'object' ? r[field] ?? r[1] : r)), labels = d.label ? rows.map((r) => r[d.label]) : null;
    src = M.seriesSource(vals, { unit: d.unit || '', spread: true, labels });
  }
  else if (kind === 'sheet') {
    const L = await import('./loop.js'), { toImage } = await import('./livestill.js'), img = await ready(el.querySelector('img')), full = toImage(img, 1600);
    const [cols, rows] = (d.sheet || '8 3').split(/[\s,]+/).map(Number);
    src = M.sheetSource(await offload('../loop.js', 'sheetFrames', full, cols, rows, { measure: false }), { fps: num(d.fps, 12), delay: num(d.delay, 0.25) });
  }
  else throw new Error(`alive: framemosaic source "${kind}" unknown`);
  const c = document.createElement('canvas'); c.className = 'alive-c alive-mosaic'; c.setAttribute('aria-hidden', 'true'); el.appendChild(c);
  const g = c.getContext('2d'), seed = num(d.seed, 5), recut = { fps: 1, holds: [num(d.hold, 6.4)] }, rate = num(d.texRate, 6);
  // the canvas is full resolution for the labels; tiles are computed at no more than 480 px wide and scaled up
  let bw = 1, bh = 1; const scratch = document.createElement('canvas'), font = (getComputedStyle(el).getPropertyValue('--face-utility').trim() || 'Conso') + ', ui-monospace, monospace';
  const fit = () => { const r = el.getBoundingClientRect(), k = dprCap(), s = Math.min(1, 480 / Math.max(1, r.width)); c.width = Math.max(1, Math.round(r.width * k)); c.height = Math.max(1, Math.round(r.height * k)); bw = Math.max(1, Math.round(r.width * s)); bh = Math.max(1, Math.round(r.height * s)); c.style.width = r.width + 'px'; c.style.height = r.height + 'px'; };
  fit(); new ResizeObserver(fit).observe(el);
  return {
    priority: num(d.priority, 1),
    key: (t) => `${M.layoutOn(seed, t, recut).k}|${Math.floor(t * rate)}|${c.width}`,
    render(t) { const L = M.layoutOn(seed, t, recut, { depth: num(d.depth, 4), minSide: num(d.minSide, 0.12) }); M.drawMosaic(g, M.renderMosaic(bw, bh, L, src, t, { gap: 0 }), { size: num(d.labelSize, 11), scratch, font, gap: num(d.gap, 2) }); el.classList.add('alive-on'); },
    rest() { el.classList.remove('alive-on'); }, resume() {},
  };
}

// A GIF or APNG played on the shared clock with our own decoder, so it phases with the page, stops offscreen and
// holds its first frame under reduced motion (a browser's own GIF playback does none of these).
async function gif(el) {
  const G = await import('./gif.js'), img = imgOf(el), d = el.dataset, bytes = new Uint8Array(await (await fetch(d.src || img.src)).arrayBuffer());
  const dec = G.decodeGif && bytes[0] === 0x47 ? G.decodeGif(bytes) : await G.decodeAPNG(bytes), W = dec.width, H = dec.height;
  const c = overlay(img, 'alive-gif'), g = c.getContext('2d'), bms = await Promise.all(dec.frames.map((f) => createImageBitmap(new ImageData(new Uint8ClampedArray(f.rgba), W, H))));
  const ends = []; let acc = 0; for (const f of dec.frames) ends.push((acc += f.delayMs / 1000)); const total = acc;
  const at = (t) => { const x = t % total; return ends.findIndex((e) => x < e); };
  return { priority: num(d.priority, 2), key: (t) => at(t), render(t) { g.drawImage(bms[at(t)], 0, 0, c.width, c.height); show(c, true); }, rest() { show(c, false); }, resume() {} };
}

// Page grain: a fixed overlay of six pre-made grain tiles cycled on the 12 Hz boil clock. Very low opacity.
async function grain() {
  const c = document.createElement('canvas'); c.className = 'alive-grain'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c);
  const tiles = [...Array(6)].map((_, k) => { const t = document.createElement('canvas'); t.width = t.height = 160; const x = t.getContext('2d'), im = x.createImageData(160, 160); let s = 0x9e3779b1 ^ k; for (let i = 0; i < 160 * 160; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const v = 128 + (((s >>> 0) % 1000) / 1000 - 0.5) * 180; im.data.set([v, v, v, 255], i * 4); } x.putImageData(im, 0, 0); return t; });
  const g = c.getContext('2d'), ck = clock('boil-12', { seed: 9 });
  const fit = () => { c.width = Math.ceil(innerWidth / 2); c.height = Math.ceil(innerHeight / 2); };
  fit(); addEventListener('resize', fit);
  const draw = (k) => { g.fillStyle = g.createPattern(tiles[k], 'repeat'); g.fillRect(0, 0, c.width, c.height); };
  draw(0);
  return { priority: 0, key: (t) => ck.at(t).index % 6, render(t) { draw(ck.at(t).index % 6); }, rest() { draw(0); }, resume() {} };
}

// Light drift: CSS variables on the slot (or the page) for a slow pass of light; CSS draws it (alive.css).
async function light(el) {
  el.classList.add('alive-light');
  return {
    priority: 1, key: (t) => Math.floor(t * 15),
    render(t, ctx) { const p = ((t / 25.6) % 1); el.style.setProperty('--alive-lx', (p * 160 - 30).toFixed(2) + '%'); el.style.setProperty('--alive-la', (0.5 * ctx.level).toFixed(3)); el.style.setProperty('--alive-breath', Math.sin((2 * Math.PI * t) / 6.4).toFixed(3)); },
    rest() { el.style.setProperty('--alive-la', '0'); }, resume() {},
  };
}

// Orbit: text set on an SVG path travels round it once per `data-lap` seconds (4 bars by default).
async function orbit(el) {
  const tp = el.querySelector('textPath'), lap = num(el.dataset.lap, 25.6), base = parseFloat(tp?.getAttribute('startOffset') || '0');
  if (!tp) throw new Error('alive: orbit needs a <textPath>');
  return { priority: 1, key: (t) => Math.floor(t * 20), render(t) { tp.setAttribute('startOffset', (((base + (t / lap) * 100) % 100)).toFixed(2) + '%'); }, rest() { tp.setAttribute('startOffset', base + '%'); }, resume() {} };
}

export const LIVES = { livestill, still: livestill, wiggle, loop, framemosaic, mosaic: framemosaic, gif, grain, light, orbit };
