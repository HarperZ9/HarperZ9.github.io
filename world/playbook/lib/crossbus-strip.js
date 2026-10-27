// lib/crossbus-strip.js: the event stream as a strip, the score of a crossbus log. One row per event type, time
// runs left to right; a derived event is joined to its cause by a thin line, so a route reads as a stroke between rows.
// Draws into a lib/raster.js image (node, goldens) or a CanvasRenderingContext2D (browser) through one small painter.
import { image, fill, rect, line, disc } from './raster.js';
import { hexToRgb, clamp } from './util.js';

export const ROWS = ['pointer', 'value', 'word', 'note', 'step'];
const INK = { ground: '#0f0f0e', ink: '#eee9df', muted: '#6f6a62', rule: '#2a2926', hot: '#e0177e' };

function painter(target) {
  if (target && typeof target.fillRect === 'function') {
    const g = target, col = (c, a) => { const [r, gg, b] = hexToRgb(c).map((v) => Math.round(v * 255)); return `rgba(${r},${gg},${b},${a})`; };
    return {
      w: g.canvas.width, h: g.canvas.height,
      rect: (x0, y0, x1, y1, c, a = 1) => { g.fillStyle = col(c, a); g.fillRect(x0, y0, x1 - x0, y1 - y0); },
      line: (x0, y0, x1, y1, hw, c, a = 1) => { g.strokeStyle = col(c, a); g.lineWidth = Math.max(1, hw * 2); g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); },
      disc: (x, y, r, c, a = 1) => { g.fillStyle = col(c, a); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); },
    };
  }
  const im = target;
  return { w: im.w, h: im.h, rect: (x0, y0, x1, y1, c, a = 1) => rect(im, x0, y0, x1, y1, c, a), line: (x0, y0, x1, y1, hw, c, a = 1) => line(im, x0, y0, x1, y1, hw, c, a), disc: (x, y, r, c, a = 1) => disc(im, x, y, r, c, a) };
}

export function drawStrip(target, log, { t0 = 0, t1 = null, ground = true, ink = INK, pad = 8 } = {}) {
  const p = painter(target), { w, h } = p, ev = log.events, end = t1 ?? Math.max(1e-3, ...ev.map((e) => e.t));
  const rh = (h - 2 * pad) / ROWS.length, X = (t) => pad + ((t - t0) / (end - t0 || 1)) * (w - 2 * pad), Y = (type, u = 0.5) => pad + ROWS.indexOf(type) * rh + rh * (1 - u);
  if (ground) p.rect(0, 0, w, h, ink.ground, 1);
  for (let r = 1; r < ROWS.length; r++) p.rect(pad, pad + r * rh, w - pad, pad + r * rh + 1, ink.rule, 1);
  const pos = new Map();
  for (const e of ev) {
    if (e.t < t0 || e.t > end) continue;
    const x = X(e.t), top = pad + ROWS.indexOf(e.type) * rh, u = e.type === 'value' ? clamp(e.v) : e.type === 'note' ? clamp((e.midi - 36) / 60) : e.type === 'pointer' ? clamp(1 - e.y) : 0.5;
    pos.set(e.seq, [x, Y(e.type, e.type === 'word' || e.type === 'step' ? 0.5 : 0.12 + 0.76 * u)]);
    if (e.cause != null && pos.has(e.cause)) { const [cx, cy] = pos.get(e.cause); p.line(cx, cy, x, pos.get(e.seq)[1], 0.35, ink.muted, 0.8); }
    if (e.type === 'step') p.rect(x - 0.75, pad, x + 0.75, h - pad, ink.hot, 1);
    else if (e.type === 'value') p.rect(x - 1, top + rh * (0.92 - 0.8 * u), x + 1, top + rh * 0.92, ink.ink, 0.9);
    else if (e.type === 'word') p.rect(x, top + rh * 0.36, x + Math.max(2, 3.2 * e.text.length), top + rh * 0.64, ink.ink, 0.85);
    else if (e.type === 'note') p.line(x, pos.get(e.seq)[1], x + Math.max(2, e.dur * 40), pos.get(e.seq)[1], 1 + e.vel, ink.ink, 0.95);
    else p.disc(x, pos.get(e.seq)[1], 1.2 + 2.2 * clamp(e.p), ink.ink, 0.85);
  }
  return target;
}

export const stripImage = (log, w = 640, h = 200, o = {}) => drawStrip(fill(image(w, h), INK.ground), log, o);
