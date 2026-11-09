// framemosaic.js: a collage or mosaic whose tiles are made of time, data or code.
//   frames  each tile is a window onto a clip at its own delay, so one picture holds many moments at once
//           (the windowed echo of set 26 zjf, joined with the contact sheet and Muybridge's grid);
//   series  each tile is one cell of a data series: its tone is the value, its label is the number;
//   code    our own source rendered as texture: one cell per character, inked by token class, so indentation,
//           line length and the rhythm of a program become an image (the author's "code becoming image").
// The partition is a seeded recursive split. It re-cuts on a cadence clock; consecutive layouts share at most
// 30% of their rectangles, and exactly one tile per layout carries the hot mark (the PLAYBOOK 4.2 acceptance).
// It extends, not copies: tiles drop into a feed-25 compose sheet through intoSheet(), and the recut clock is
// cadence.js. Our tiles are filled from our own generators, our code, our data and cleared plates.
import { image, hash01, rng, sample, clamp } from './lib/img.js';
import { clock } from './lib/clock.js';

export const INKS = Object.freeze({ ground: '#0f0f0e', ink: '#eee9df', bone: '#d9e3c4', slate: '#a9b7d6', ochre: '#b8893a', hot: '#e0177e', rule: '#2a2a27' });
const RGB = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export const SPEC = Object.freeze({
  params: {
    depth: { range: [1, 7], unit: 'split levels', default: 4 },
    minSide: { range: [0.04, 0.5], unit: 'fraction of the frame, smallest tile side', default: 0.09 },
    gap: { range: [0, 8], unit: 'px between tiles', default: 2 },
    shareMax: { range: [0, 1], unit: 'largest share of rectangles two consecutive layouts may share', default: 0.3 },
    delay: { range: [0, 2], unit: 's of clip delay per tile, frames source', default: 0.18 },
  },
  determinism: 'layout k is a pure function of (seed, k); a frame is a pure function of (layout, sources, t)',
});

// A seeded recursive split of the unit square into rectangles [x, y, w, h].
export function partition(seed, { depth = 4, minSide = 0.09, aspect = 1 } = {}) {
  const r = rng(seed), out = [];
  const split = (x, y, w, h, d) => {
    const canV = w * aspect >= 2 * minSide * aspect && w >= 2 * minSide, canH = h >= 2 * minSide;
    if (d <= 0 || (!canV && !canH) || (d < depth - 1 && r() < 0.18)) { out.push([x, y, w, h]); return; }
    const vert = canV && (!canH || (w * aspect > h ? r() < 0.75 : r() < 0.25));
    const f = 0.3 + 0.4 * r(), q = (v) => Math.round(v * 1000) / 1000;
    if (vert) { const a = q(w * f); split(x, y, a, h, d - 1); split(q(x + a), y, q(w - a), h, d - 1); }
    else { const a = q(h * f); split(x, y, w, a, d - 1); split(x, q(y + a), w, q(h - a), d - 1); }
  };
  split(0, 0, 1, 1, depth);
  return out;
}

const key = (r) => r.join(',');
export const shared = (a, b) => { const s = new Set(a.map(key)); return b.filter((r) => s.has(key(r))).length / Math.max(a.length, b.length); };

// Layout number k of a recut sequence, with its hot tile. Re-seeds until it shares at most shareMax with layout k-1.
export function layoutAt(seed, k, opts = {}) {
  const pick = (kk) => { for (let a = 0; a < 16; a++) { const s = (seed * 2654435761 + kk * 40503 + a * 9973) >>> 0, p = partition(s, opts); if (kk === 0 || a === 15) return { rects: p, s }; const prev = layoutAt(seed, kk - 1, opts).rects; if (shared(prev, p) <= (opts.shareMax ?? 0.3)) return { rects: p, s }; } };
  const memo = (layoutAt.memo ||= new Map()), mk = `${seed}|${k}|${JSON.stringify(opts)}`;
  if (memo.has(mk)) return memo.get(mk);
  const { rects, s } = pick(k), hot = Math.floor(hash01(s, 7) * rects.length);
  const L = { k, rects, hot }; if (memo.size > 512) memo.clear(); memo.set(mk, L); return L;
}

// The layout showing at time t on a cadence clock (preset name or def), e.g. 'recut-3.6' or { fps: 1, holds: [4] }.
export const layoutOn = (seed, t, clk = { fps: 1, holds: [5] }, opts = {}) => layoutAt(seed, clock(clk, { seed }).at(t).index, opts);

// ---------- sources ----------
// Frames: getFrame(t) returns an RGBA image. 'window' shows the tile's own region at a delay; 'whole' shrinks it.
export function framesSource(getFrame, { delay = 0.18, mode = 'window', order = 'reading' } = {}) {
  return { kind: 'frames', fill(out, rect, px, i, t) { const f = getFrame(Math.max(0, t - delay * (order === 'reading' ? i : hash01(i, 3) * 8))); blitFrom(out, f, rect, px, mode); return `t ${(t - delay * i).toFixed(2)}`; } };
}
function blitFrom(out, f, [x, y, w, h], [X, Y, W, H], mode) {
  const p = [0, 0, 0, 0];
  // whole: the frame covers the tile at its own aspect (centre crop), never stretched
  const k = Math.max(W / f.w, H / f.h), cu = W / (k * f.w), cv = H / (k * f.h);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = mode === 'window' ? x + (w * (i + 0.5)) / W : (1 - cu) / 2 + (cu * (i + 0.5)) / W, v = mode === 'window' ? y + (h * (j + 0.5)) / H : (1 - cv) / 2 + (cv * (j + 0.5)) / H;
    sample(f, u * f.w - 0.5, v * f.h - 0.5, p); out.data.set(p, ((Y + j) * out.w + X + i) * 4);
  }
}

// Series: values in reading order across tiles. With spread, the tiles span the whole series (tile i of n takes
// value floor(i x len / n)), so any layout reads the full run start to end; otherwise tile i takes value i mod len.
// labels (optional, same length) prefix each tile's number, for example the year.
export function seriesSource(values, { lo = Math.min(...values), hi = Math.max(...values), ink = INKS.ink, low = INKS.rule, unit = '', spread = false, labels = null } = {}) {
  const a = RGB(low), b = RGB(ink);
  return { kind: 'series', fill(out, rect, [X, Y, W, H], i, t, count = values.length) {
    const k = spread ? Math.min(values.length - 1, Math.floor((i * values.length) / count)) : i % values.length;
    const v = values[k], tt = clamp((v - lo) / (hi - lo || 1)), c = a.map((q, j) => q + (b[j] - q) * tt), bar = Math.round(H * tt);
    for (let j = 0; j < H; j++) for (let x = 0; x < W; x++) { const o = ((Y + j) * out.w + X + x) * 4, on = j >= H - bar; out.data[o] = on ? c[0] : a[0] * 0.6; out.data[o + 1] = on ? c[1] : a[1] * 0.6; out.data[o + 2] = on ? c[2] : a[2] * 0.6; out.data[o + 3] = 255; }
    return `${labels ? labels[k] + ' ' : ''}${v}${unit}`;
  } };
}

// Sheet frames: the cells of a sequence sheet (Muybridge's plates) as a clip at fps; each tile shows a whole cell.
export function sheetSource(cells, { fps = 12, delay = 0.25 } = {}) {
  const n = cells.length;
  return framesSource((t) => cells[Math.floor(t * fps) % n], { delay, mode: 'whole' });
}

// Code: tokenise JavaScript into classes, one cell per character.
export function tokens(src) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|(\b\d[\d_.xXa-fA-FeE]*\b)|(\b(?:import|export|from|const|let|var|function|return|if|else|for|while|of|in|new|class|extends|this|async|await|throw|try|catch|default|break|continue|typeof|null|true|false|undefined)\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s\w])/g;
  const out = []; let m;
  while ((m = re.exec(src))) out.push({ text: m[0], cls: m[1] ? 'comment' : m[2] ? 'string' : m[3] ? 'number' : m[4] ? 'keyword' : m[5] ? 'name' : m[6] ? 'space' : 'punct' });
  return out;
}
export const CODE_INKS = Object.freeze({ comment: INKS.slate, string: INKS.ochre, number: INKS.hot, keyword: INKS.bone, name: INKS.ink, punct: '#8f8a80' });

// The code as an image: cols x lines cells, each cell cw x ch px; a character is a bar of its token's ink.
export function codeImage(src, { cw = 2, ch = 4, cols = 120, ground = INKS.ground } = {}) {
  const lines = src.split('\n'), w = cols * cw, h = lines.length * ch, im = image(w, h, [...RGB(ground), 255]);
  let x = 0, y = 0;
  for (const t of tokens(src)) for (const c of t.text) {
    if (c === '\n') { x = 0; y++; continue; }
    if (c !== ' ' && c !== '\t' && x < cols) { const col = RGB(CODE_INKS[t.cls] || INKS.ink); for (let j = 1; j < ch - 1; j++) for (let i = 0; i < cw; i++) im.data.set([...col, 255], ((y * ch + j) * w + x * cw + i) * 4); }
    x += c === '\t' ? 2 : 1;
  }
  return im;
}

// Code source: each tile scrolls through the code image at its own line, a slow read down the program.
export function codeSource(src, { linesPerS = 1.5, ...o } = {}) {
  const im = codeImage(src, o), lineH = o.ch || 4;
  return { kind: 'code', image: im, fill(out, rect, [X, Y, W, H], i, t) {
    const top = ((Math.floor(t * linesPerS) + Math.floor(hash01(i, 11) * (im.h / lineH))) * lineH) % Math.max(1, im.h - H), left = Math.floor(hash01(i, 13) * Math.max(1, im.w - W) * 0.3);
    for (let j = 0; j < H; j++) for (let x = 0; x < W; x++) { const sy = (top + j) % im.h, sx = Math.min(im.w - 1, left + x); out.data.set(im.data.subarray((sy * im.w + sx) * 4, (sy * im.w + sx) * 4 + 4), ((Y + j) * out.w + X + x) * 4); }
    return `L${Math.floor(top / lineH) + 1}`;
  } };
}

// ---------- render ----------
export const tilePx = (r, w, h, gap) => { const X = Math.round(r[0] * w), Y = Math.round(r[1] * h), X1 = Math.round((r[0] + r[2]) * w), Y1 = Math.round((r[1] + r[3]) * h); return [X + gap, Y + gap, Math.max(1, X1 - X - 2 * gap), Math.max(1, Y1 - Y - 2 * gap)]; };

// CPU frame. sources: one source or an array cycled across tiles. Returns { image, labels: [{ px, text, hot }] }.
export function renderMosaic(w, h, layout, sources, t = 0, { gap = 2, ground = INKS.ground, hot = INKS.hot } = {}) {
  const out = image(w, h, [...RGB(ground), 255]), src = [].concat(sources), labels = [];
  layout.rects.forEach((r, i) => {
    const px = tilePx(r, w, h, gap), text = src[i % src.length].fill(out, r, px, i, t, layout.rects.length), isHot = i === layout.hot;
    if (isHot) ring(out, px, RGB(hot));
    labels.push({ px, text, hot: isHot });
  });
  return { image: out, labels };
}
function ring(out, [X, Y, W, H], c) {
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (i < 2 || j < 2 || i >= W - 2 || j >= H - 2) out.data.set([...c, 255], ((Y + j) * out.w + X + i) * 4);
}

// Canvas: draw the CPU frame scaled to the canvas, then set the labels at the canvas's full resolution in the
// house mono, so tiles can be computed small while the type stays sharp. The hot mark is the ring, not the text.
export function drawMosaic(ctx, frame, { font = 'Conso, ui-monospace, monospace', size = 10, ink = INKS.ink, hot = INKS.hot, ground = INKS.ground, gap = 2, scratch = null } = {}) {
  const { image: im, labels } = frame, cv = ctx.canvas, k = cv.width / im.w, kd = cv.width / (cv.getBoundingClientRect().width || cv.width);
  const tmp = scratch || (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(im.w, im.h) : Object.assign(document.createElement('canvas'), { width: im.w, height: im.h }));
  if (tmp.width !== im.w || tmp.height !== im.h) { tmp.width = im.w; tmp.height = im.h; }
  tmp.getContext('2d').putImageData(new ImageData(im.data, im.w, im.h), 0, 0);
  ctx.fillStyle = ground; ctx.fillRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // each tile is lifted from the small buffer into its own full-resolution box, so gutters and rings stay sharp
  const g = Math.round(gap * kd);
  for (const l of labels) {
    const [x, y, w, h] = l.px, X = Math.round(x * k) + g, Y = Math.round(y * k) + g, W = Math.round((x + w) * k) - X - g, H = Math.round((y + h) * k) - Y - g;
    if (W < 1 || H < 1) continue;
    ctx.drawImage(tmp, x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1), X, Y, W, H);
    if (l.hot) { ctx.strokeStyle = hot; ctx.lineWidth = Math.max(2, Math.round(2 * kd)); ctx.strokeRect(X + ctx.lineWidth / 2, Y + ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth); }
    if (W >= 60 * kd && H >= 22 * kd) { ctx.font = `${Math.round(size * kd)}px ${font}`; ctx.textBaseline = 'top'; ctx.fillStyle = ink; ctx.fillText(l.text, X + 5 * kd, Y + 5 * kd); }
  }
}

// Drop a layout into a feed-25 compose sheet: layerFor(tile, i) returns a compose Layer, colour or null.
// Records meta.tiles the same way sheet.mosaic() does, so downstream tools read both alike.
export function intoSheet(sheet, layout, layerFor, { box = sheet.inner ?? { x: 0, y: 0, w: sheet.w, h: sheet.h }, gap = 0 } = {}) {
  const Layer = sheet.constructor, tiles = [];
  layout.rects.forEach((r, i) => {
    const [x, y, w, h] = tilePx(r, box.w, box.h, gap), f = layerFor({ rect: r, w, h, hot: i === layout.hot }, i); if (f == null) return;
    const L = typeof f === 'string' || Array.isArray(f) ? new Layer(w, h).fill(f) : f;
    sheet.place(L, box.x + x, box.y + y); tiles.push({ i, x: box.x + x, y: box.y + y, w, h, kind: typeof f === 'string' ? f : 'layer', hot: i === layout.hot });
  });
  sheet.meta.tiles = (sheet.meta.tiles ?? []).concat(tiles); return sheet;
}
