// Glyph-cell: a word that resolves out of noise, in a grid of cells. Each cell's dot is sized by the exact share of the
// cell the letter covers (area-proportional: radius = cell/2 x sqrt(coverage)), measured from the coverage mask at
// sub-cell precision, so an edge cell is a smaller dot rather than a grey one, and every dot is anti-aliased.
// At first every cell flickers on a 12 fps boil clock. Then a front sweeps from the lower left on the cascade measured
// in feed set 20 (10/50/90 percent at 0.53, 1.13 and 1.40 s, a 1.8 percent overshoot) and each cell lands with a small
// back-out. The accent marks the front itself: a cell is accent-coloured only while it is landing, then cools to ink.
// Materials: "ink" (printed dots with a little dot gain on paper) or "led" (a dark panel, unlit diodes visible, lit
// diodes with a bloom).
import { cascade, boil } from '../../../techniques/lib/timing.js';
import { canvas, hash2, svgDoc, parseColor } from '../paint.mjs';

export const meta = {
  id: 'glyphcell', title: 'Glyph-cell', renderer: '2d', ground: 'page', weight: 900,
  lineage: 'The halftone screen and the dot-matrix sign; the decode cascade measured in feed set 20 (clips Xoyi, vApt).',
  does: 'A field of cells flickers as noise, then resolves into the word on a measured cascade; the front is the accent.',
  params: {
    cell: 'cell pitch, work px, 3 to 24 (default 0.8 x half stroke for ink, 0.62 for LED)',
    material: '"ink" (default) or "led"',
    speed: 'cascade time scale, 0.3 to 2 (default 0.62: the measured 1.5 s build spans about 2.4 s)',
    land: 'share of the front\'s travel a cell takes to land, 0.02 to 0.2 (default 0.07)',
    misregister: 'tint plate offset as a share of the cell, 0 to 0.4 (default 0.2 right, 0.12 down); ink only',
    grain: 'paper grain under ink dots, true (default) or false',
  },
};

// Coverage of each cell: the mean of the mask over the cell's area (exact for the rasterised letter).
export function coverage(g, c) {
  const cols = Math.ceil(g.w / c), rows = Math.ceil(g.h / c), cov = new Float32Array(cols * rows);
  for (let y = 0; y < g.h; y++) { const j = Math.floor(y / c); for (let x = 0; x < g.w; x++) cov[j * cols + Math.floor(x / c)] += g.mask[y * g.w + x]; }
  for (let i = 0; i < cov.length; i++) cov[i] = Math.min(1, cov[i] / (c * c));
  return { cov, cols, rows };
}
// Area-proportional dot radius as a share of the cell.
export const dotRadius = cv => 0.5 * Math.sqrt(Math.max(0, Math.min(1, cv)));

// An ink dot as it lands on paper: the edge wanders a little (the screen's dot spreads into fibre), the dot gains
// about 6 percent, and ink pools slightly darker at the rim. `variant` seeds the edge.
function inkDot(size, rgb, variant) {
  const c = canvas(size, size), x = c.getContext('2d'), m = size / 2, R = m - 1.2, n = 40;
  x.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, j = 1 + 0.12 * (hash2(i % n, variant, 13) - 0.5) + 0.06 * Math.sin(a * 3 + variant); const r = R * j; i ? x.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r) : x.moveTo(m + Math.cos(a) * r, m + Math.sin(a) * r); }
  x.closePath(); x.fillStyle = `rgba(${rgb},.92)`; x.shadowColor = `rgba(${rgb},.5)`; x.shadowBlur = size * 0.04; x.fill();
  x.shadowBlur = 0; x.lineWidth = size * 0.05; x.strokeStyle = `rgba(${rgb},.55)`; x.stroke();
  return c;
}

function disc(size, rgb, glow) {
  const c = canvas(size, size), x = c.getContext('2d'), m = size / 2;
  if (glow) { const g = x.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.28, `rgba(${rgb},.95)`); g.addColorStop(0.36, `rgba(${rgb},.32)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, size, size); }
  else { x.fillStyle = `rgb(${rgb})`; x.beginPath(); x.arc(m, m, m - 0.5, 0, Math.PI * 2); x.fill(); }
  return c;
}

export async function create(g, env) {
  const o = env.opts, c = o.cell ?? Math.max(4, g.half * (o.material === 'led' ? 0.62 : 0.8)), led = o.material === 'led', k = env.k, seed = env.seed % 997;
  const { cov, cols, rows } = coverage(g, c), n = cols * rows;
  const ink = parseColor(led ? (o.lit ?? '#ffb04a') : env.theme.ink).join(','), hot = parseColor(o.front ?? (led ? '#fff1d6' : env.theme.accent)).join(',');
  const start = new Float32Array(n), ox = c * 0.5, oy = g.h, maxD = Math.hypot(g.w, g.h);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) start[j * cols + i] = Math.min(1, Math.hypot(i * c - ox, j * c + c - oy) / maxD * 1.08 + hash2(i, j, seed + 3) * 0.03);
  // sprites: one large disc per colour, scaled per cell (smoothed), so every dot edge is anti-aliased at any size
  const S = Math.max(8, Math.ceil(c * env.k * (led ? 3 : 1)) * (led ? 1 : 2)), dInk = disc(S, ink, led), dHot = disc(S, hot, led), dOff = disc(S, led ? '58,46,34' : ink, false);
  // printed ink: six edge variants for the key plate, and a warm tint plate printed under it, slightly off register
  const inkV = led ? null : [0, 1, 2, 3, 4, 5].map(v => inkDot(S, ink, v + seed));
  const tintRgb = parseColor(env.theme.dark ? '#7a5a3c' : '#c9a77e').join(','), tint = led ? null : inkDot(S, tintRgb, 99);
  const mis = [c * (o.misregister ?? 0.2), c * (o.misregister ?? 0.2) * 0.6];
  const keyDot = (i, j) => (inkV ? inkV[(hash2(i, j, seed + 41) * 6) | 0] : dInk);
  const spread = led ? 3 : 1.06; // a glow sprite is three cells wide; an ink dot gains about 6 percent on paper
  const put = (x, sp, i, j, r, a = 1) => { if (r <= 0.004 || a <= 0) return; const w = c * 2 * r * spread; x.globalAlpha = a; x.drawImage(sp, i * c + c / 2 - w / 2, j * c + c / 2 - w / 2, w, w); };
  const W = g.w * k, H = g.h * k, mk = () => { const L = canvas(W, H), x = L.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0); x.imageSmoothingQuality = 'high'; if (led) x.globalCompositeOperation = 'lighter'; return [L, x]; };
  // the panel with its unlit diodes (LED), or a faint screen dot on paper (ink), drawn once
  const [base, bx] = mk();
  if (led) { bx.globalCompositeOperation = 'source-over'; bx.fillStyle = '#0c0b0a'; bx.fillRect(0, 0, g.w, g.h); }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) put(bx, dOff, i, j, led ? 0.3 / 3 : 0.07, led ? 0.9 : 0.22); // an unlit diode, its true size (the sprite spread is 3)
  if (!led && o.grain !== false) { const gr = canvas(64, 64), gx = gr.getContext('2d'), id = gx.createImageData(64, 64); for (let i = 0; i < 64 * 64; i++) { const v = hash2(i % 64, (i / 64) | 0, 5) * 255; id.data.set([v, v, v, 10], i * 4); } gx.putImageData(id, 0, 0); bx.save(); bx.globalCompositeOperation = 'source-over'; bx.fillStyle = bx.createPattern(gr, 'repeat'); bx.fillRect(0, 0, g.w, g.h); bx.restore(); }
  const noise = [0, 1, 2, 3].map(f => { const [L, x] = mk(); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { if (hash2(i, j, seed + 101 + f * 13) < 0.62) continue; put(x, dInk, i, j, (0.12 + 0.3 * hash2(i, j, seed + 7 + f)) / (led ? 3 : 1), led ? 0.6 : 0.3); } return L; });
  const [settled, sx] = mk(), landed = new Uint8Array(n), speed = o.speed ?? 0.62, land = o.land ?? 0.07;
  const back = u => { const s = 2.2; u -= 1; return u * u * ((s + 1) * u + s) + 1; };
  const rad = id => dotRadius(cov[id]) / (led ? 3 : 1) * (led ? 2.2 : 1); // a lit diode's core is the inner third of its sprite
  let all = false;
  return {
    cells: n, pitch: c, coverage: cov,
    draw(ctx, t) {
      // the front follows the cascade, scaled so its overshoot carries it past the last cell, then finishes linearly
      const ts = t * speed, p = all ? 2 : cascade(ts) * 1.08 + Math.max(0, ts - 1.5);
      ctx.clearRect(0, 0, g.w, g.h); ctx.drawImage(base, 0, 0, g.w, g.h);
      if (p < 1.1) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, g.w, g.h); ctx.arc(ox, oy, Math.max(0, (p - 0.05) * maxD / 1.08), 0, Math.PI * 2, true); ctx.clip('evenodd'); ctx.drawImage(noise[boil(t) % 4], 0, 0, g.w, g.h); ctx.restore(); }
      // land cells first (into the settled layer), then show the layer, then the cells still in flight on top
      let moving = p < 1.1; const flying = [];
      for (let id = 0; id < n; id++) {
        if (landed[id] || p < start[id]) continue;
        if (cov[id] < 0.015) { landed[id] = 1; continue; }
        const r = rad(id), u = all || p > 1.1 ? 1 : Math.min(1, (p - start[id]) / land), i = id % cols, j = (id / cols) | 0;
        if (u >= 1) { if (tint) { sx.save(); sx.translate(mis[0], mis[1]); put(sx, tint, i, j, r * 1.08, 0.7); sx.restore(); } put(sx, keyDot(i, j), i, j, r); landed[id] = 1; continue; }
        flying.push(id, u); moving = true;
      }
      sx.globalAlpha = 1; ctx.drawImage(settled, 0, 0, g.w, g.h);
      if (led) ctx.globalCompositeOperation = 'lighter';
      for (let q = 0; q < flying.length; q += 2) {
        // landing: the front's accent, scaling in with a back-out, crossfading to ink over the last third
        const id = flying[q], u = flying[q + 1], i = id % cols, j = (id / cols) | 0, s = Math.max(0, back(u)) * rad(id), f = Math.max(0, (u - 0.66) / 0.34);
        put(ctx, dHot, i, j, s, 1 - f); put(ctx, keyDot(i, j), i, j, s, f);
      }
      ctx.globalAlpha = 1; sx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      return moving;
    },
    finish() { all = true; },
    replay() { all = false; landed.fill(0); sx.save(); sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, W, H); sx.restore(); },
    svg() {
      const parts = [];
      for (let id = 0; id < n; id++) { if (cov[id] < 0.015) continue; const r = dotRadius(cov[id]), i = id % cols, j = (id / cols) | 0; parts.push(`<circle cx="${(i * c + c / 2).toFixed(2)}" cy="${(j * c + c / 2).toFixed(2)}" r="${(c * r).toFixed(2)}"/>`); }
      return svgDoc(g, `<g fill="rgb(${ink})">${parts.join('')}</g>`, { ground: led ? '#0c0b0a' : null });
    },
  };
}
