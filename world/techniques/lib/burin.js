// lib/burin.js: engraving that follows the form, drawn by a pen that has physics.
// 1. A structure tensor reads the photograph's isophotes (lines of equal brightness).
// 2. Evenly spaced streamlines (Jobard and Lefer, 1997) run along them, the way an engraver's burin follows a cheek.
// 3. Line width swells with darkness, as in copperplate line engraving, and crosses a second layer in the shadows.
// 4. A plotter pen model adds what a machine does to ink: a pool at pen-down, thinning at speed, a reservoir that runs dry.
import { boxBlur, sobel, sample, rng, fbm, clamp, toLuma } from './util.js';

// Orientation field: unit tangent vectors along the isophotes, blended toward a default hatch angle where the
// image has no clear structure (low coherence), so flat areas still get a calm, engraver's parallel hatch.
export function orientationField(luma, w, h, o = {}) {
  const r = o.radius ?? 5, base = o.baseAngle ?? -0.5, seed = o.seed ?? 3;
  const { gx, gy } = sobel(boxBlur(luma, w, h, 1), w, h);
  const n = w * h, jxx = new Float32Array(n), jxy = new Float32Array(n), jyy = new Float32Array(n);
  for (let i = 0; i < n; i++) { jxx[i] = gx[i] * gx[i]; jxy[i] = gx[i] * gy[i]; jyy[i] = gy[i] * gy[i]; }
  const A = boxBlur(jxx, w, h, r), B = boxBlur(jxy, w, h, r), C = boxBlur(jyy, w, h, r);
  const tx = new Float32Array(n), ty = new Float32Array(n), coh = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = A[i], b = B[i], c = C[i];
    const th = 0.5 * Math.atan2(2 * b, a - c) + Math.PI / 2; // gradient angle turned a quarter: along the form
    const tr = a + c, disc = Math.sqrt((a - c) * (a - c) + 4 * b * b), k = tr > 1e-7 ? disc / tr : 0;
    const q = clamp(k * k * (o.gain ?? 1.6));
    const bend = base + (fbm(x / 140, y / 140, seed, 3) - 0.5) * 1.2, dx = Math.cos(bend), dy = Math.sin(bend);
    let ux = Math.cos(th), uy = Math.sin(th);
    if (ux * dx + uy * dy < 0) { ux = -ux; uy = -uy; }
    const vx = q * ux + (1 - q) * dx, vy = q * uy + (1 - q) * dy, l = Math.hypot(vx, vy) || 1;
    tx[i] = vx / l; ty[i] = vy / l; coh[i] = q;
  }
  return { tx, ty, coh, w, h };
}

// Spatial hash of placed points, cell size = dsep.
function grid(w, h, cell) {
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), cells = Array.from({ length: cols * rows }, () => []);
  return {
    add(x, y, id) { const c = Math.min(cols - 1, (x / cell) | 0), r = Math.min(rows - 1, (y / cell) | 0); cells[r * cols + c].push(x, y, id); },
    near(x, y, d, id) {
      const c0 = Math.max(0, ((x - d) / cell) | 0), c1 = Math.min(cols - 1, ((x + d) / cell) | 0), r0 = Math.max(0, ((y - d) / cell) | 0), r1 = Math.min(rows - 1, ((y + d) / cell) | 0), d2 = d * d;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const a = cells[r * cols + c]; for (let k = 0; k < a.length; k += 3) if (a[k + 2] !== id) { const ex = a[k] - x, ey = a[k + 1] - y; if (ex * ex + ey * ey < d2) return true; } }
      return false;
    },
  };
}

// Integrate one direction from a seed with midpoint steps, following the field and keeping orientation continuous.
function integrate(f, sx, sy, sign, g, id, o) {
  const pts = [], step = o.step, dtest = o.dsep * o.test;
  let x = sx, y = sy, px = 0, py = 0;
  for (let n = 0; n < o.maxSteps; n++) {
    let vx = sample(f.tx, f.w, f.h, x, y), vy = sample(f.ty, f.w, f.h, x, y);
    if (n === 0) { vx *= sign; vy *= sign; } else if (vx * px + vy * py < 0) { vx = -vx; vy = -vy; }
    const mx = x + vx * step * 0.5, my = y + vy * step * 0.5;
    let wx = sample(f.tx, f.w, f.h, mx, my), wy = sample(f.ty, f.w, f.h, mx, my);
    if (wx * vx + wy * vy < 0) { wx = -wx; wy = -wy; }
    const nx = x + wx * step, ny = y + wy * step;
    if (nx < 1 || ny < 1 || nx > f.w - 2 || ny > f.h - 2 || g.near(nx, ny, dtest, id)) break;
    px = wx; py = wy; x = nx; y = ny; pts.push(x, y);
  }
  return pts;
}

// Evenly spaced streamlines. Returns arrays of [x0,y0,x1,y1,...] in field pixels.
export function streamlines(f, o = {}) {
  const opt = { dsep: o.dsep ?? 5, test: o.test ?? 0.55, step: o.step ?? 1, maxSteps: o.maxSteps ?? 900, minLen: o.minLen ?? 6 };
  const g = grid(f.w, f.h, opt.dsep), lines = [], queue = [], R = rng(o.seed ?? 7);
  let id = 0;
  const tryLine = (sx, sy) => {
    if (g.near(sx, sy, opt.dsep * 0.98, -1)) return;
    const back = integrate(f, sx, sy, -1, g, id, opt), fwd = integrate(f, sx, sy, 1, g, id, opt);
    const pts = []; for (let i = back.length - 2; i >= 0; i -= 2) pts.push(back[i], back[i + 1]);
    pts.push(sx, sy, ...fwd);
    if (pts.length / 2 < opt.minLen) return;
    for (let i = 0; i < pts.length; i += 2) g.add(pts[i], pts[i + 1], id);
    lines.push(pts); queue.push(lines.length - 1); id++;
  };
  // seed the first line near the centre, then grow outward from every accepted line; sweep a jittered grid for islands
  tryLine(f.w / 2, f.h / 2);
  const sweep = []; for (let y = opt.dsep; y < f.h; y += opt.dsep * 3) for (let x = opt.dsep; x < f.w; x += opt.dsep * 3) sweep.push([x + R() * opt.dsep, y + R() * opt.dsep]);
  let si = 0;
  while (queue.length || si < sweep.length) {
    if (!queue.length) { tryLine(...sweep[si++]); continue; }
    const L = lines[queue.shift()];
    for (let i = 0; i < L.length - 2; i += 4) {
      const dx = L[i + 2] - L[i], dy = L[i + 3] - L[i + 1], l = Math.hypot(dx, dy) || 1;
      for (const s of [-1, 1]) tryLine(L[i] - (dy / l) * opt.dsep * s, L[i + 1] + (dx / l) * opt.dsep * s);
    }
  }
  return lines;
}

// Pen model. For one streamline with tone widths, returns strokes [x,y,w,...] split where the pen lifts.
// Speed follows an acceleration limit, so the pen is slow near pen-down and pen-up and ink pools there.
// A reservoir drains with distance and refills on each lift; when it runs low the line breaks into a dry skip.
export function penStrokes(pts, width, o = {}) {
  const accel = o.accel ?? 0.06, vmax = o.vmax ?? 2.2, lift = o.lift ?? 0.12, cap = o.reservoir ?? 520, R = rng(o.seed ?? 1);
  const out = []; let cur = null, ink = cap, v = 0;
  const n = pts.length / 2, run = new Int32Array(n + 1);
  for (let i = n - 1; i >= 0; i--) run[i] = width[i] >= lift ? run[i + 1] + 1 : 0;
  for (let i = 0; i < n; i++) {
    const w = width[i];
    if (w < lift) { if (cur) { out.push(cur); cur = null; ink = cap; v = 0; } continue; }
    if (!cur) { cur = []; v = 0; }
    const toEnd = run[i];
    v = Math.min(vmax, v + accel, Math.sqrt(2 * accel * toEnd) + 0.05);
    const pool = 1 + 0.55 * Math.exp(-v * 3), dry = ink / cap;
    ink -= 1;
    if (dry < 0.18 && R() < 0.35) { if (cur.length) out.push(cur); cur = null; ink = cap * 0.4; continue; }
    cur.push(pts[2 * i], pts[2 * i + 1], w * pool * (0.72 + 0.28 * Math.min(1, dry * 2.5)));
  }
  if (cur && cur.length > 3) out.push(cur);
  return out.filter(s => s.length >= 6);
}

// Build the whole engraving from a luma field.
export function engrave(luma, w, h, o = {}) {
  const dsep = o.dsep ?? 4.5, maxW = (o.maxW ?? 0.92) * dsep, gamma = o.gamma ?? 1.6;
  const tone = boxBlur(luma, w, h, 1), field = orientationField(luma, w, h, o);
  const layer = (f, threshold, seed) => {
    const strokes = [];
    for (const L of streamlines(f, { dsep, seed })) {
      const wd = new Float32Array(L.length / 2);
      for (let i = 0; i < wd.length; i++) { const d = 1 - sample(tone, w, h, L[2 * i], L[2 * i + 1]); wd[i] = d < threshold ? 0 : maxW * Math.pow((d - threshold) / (1 - threshold), gamma); }
      strokes.push(...penStrokes(L, wd, { seed: seed + strokes.length }));
    }
    return strokes;
  };
  const first = layer(field, o.light ?? 0.16, 11);
  const cross = { ...field, tx: field.ty.map(v => -v), ty: field.tx.slice() };
  const second = layer(cross, o.shadow ?? 0.58, 29);
  return { strokes: first.concat(second), field };
}

// Fill one stroke as a ribbon polygon, so a stroke costs one fill rather than one stroke per segment.
export function fillStroke(ctx, s, k) {
  const n = s.length / 3; if (n < 2) return;
  const L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = s[3 * b] - s[3 * a], dy = s[3 * b + 1] - s[3 * a + 1], l = Math.hypot(dx, dy) || 1, hw = s[3 * i + 2] * 0.5 * k;
    L.push(s[3 * i] * k - (dy / l) * hw, s[3 * i + 1] * k + (dx / l) * hw); Rt.push(s[3 * i] * k + (dy / l) * hw, s[3 * i + 1] * k - (dx / l) * hw);
  }
  ctx.moveTo(L[0], L[1]); for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
  for (let i = Rt.length - 2; i >= 0; i -= 2) ctx.lineTo(Rt[i], Rt[i + 1]);
  ctx.closePath();
}

// The plate: the engraving is plotted stroke by stroke inside an intaglio plate mark, then rests.
export function create(cv, assets, opts = {}) {
  const img = assets.spinner, W0 = opts.work ?? 820, H0 = Math.round(W0 * img.naturalHeight / img.naturalWidth);
  const { luma } = toLuma(img, W0, H0);
  const t0 = performance.now(), { strokes } = engrave(luma, W0, H0, { dsep: opts.dsep ?? 4.6 });
  const genMs = performance.now() - t0, x = cv.getContext('2d');
  let done = opts.reduced ? strokes.length : 0, drawn = 0, size = '';
  const perFrame = Math.ceil(strokes.length / 240);
  let k = 1, ox = 0, oy = 0;
  function base() {
    const W = cv.width, H = cv.height, m = Math.round(Math.min(W, H) * 0.06);
    k = Math.min((W - 2 * m) / W0, (H - 2 * m) / H0); ox = (W - W0 * k) / 2; oy = (H - H0 * k) / 2;
    x.fillStyle = '#f1ebdd'; x.fillRect(0, 0, W, H);
    // plate mark: the bevel the copper plate presses into damp paper, lit from the upper left
    const pm = m * 0.45; x.lineWidth = Math.max(1, m * 0.05);
    x.fillStyle = 'rgba(120,95,50,.05)'; x.fillRect(ox - pm, oy - pm, W0 * k + 2 * pm, H0 * k + 2 * pm);
    x.strokeStyle = 'rgba(80,60,30,.28)'; x.strokeRect(ox - pm, oy - pm, W0 * k + 2 * pm, H0 * k + 2 * pm);
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.strokeRect(ox - pm + 1.5, oy - pm + 1.5, W0 * k + 2 * pm, H0 * k + 2 * pm);
    drawn = 0; size = cv.width + 'x' + cv.height;
  }
  function ink(to) {
    // one path per stroke: a single giant path makes the rasteriser resolve every overlap at once (1.6 s measured)
    x.save(); x.translate(ox, oy); x.fillStyle = '#17130e';
    for (let i = drawn; i < to; i++) { x.beginPath(); fillStroke(x, strokes[i], k); x.fill(); }
    x.restore(); drawn = to;
  }
  return {
    label: 'burin', genMs, strokes: strokes.length,
    get animated() { return done < strokes.length; },
    draw() {
      if (size !== cv.width + 'x' + cv.height) base();
      if (done < strokes.length) done = Math.min(strokes.length, done + perFrame);
      if (drawn < done) ink(done);
      return done < strokes.length;
    },
    replay() { done = 0; size = ''; }, finish() { done = strokes.length; },
  };
}
