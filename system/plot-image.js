// plot-image.js: the IMAGE side of the plotter — a picture in, a field of strokes out.
//
// plotter.js already turns a canvas into three pen idioms (flow, hatch, contour). This module is
// the layer under a much larger vocabulary, and it exists because the three idioms all read the
// image the same shallow way: luminance at a point. What separates a plotter portrait that reads
// as DRAWN from one that reads as a filter is that the strokes follow the FORM — they run along
// the structure of the image, not across it.
//
// So the primitives here are the ones the non-photorealistic-rendering literature actually
// converged on:
//
//   edgeTangentFlow  the structure tensor's minor eigenvector, smoothed as a TENSOR. This is the
//                    coherent direction field from Kang, Lee & Chui's line-drawing work (2007):
//                    at every pixel, the direction along which the image changes least, which is
//                    the direction an engraver would lay the stroke.
//   xdogField        extended difference-of-Gaussians (Winnemöller 2011). A thresholded DoG that
//                    gives a clean, stylizable line response instead of Canny's speckle.
//   traceFlowLines   walk the flow field from the strongest responses, with a coverage grid so a
//                    strong edge is drawn once rather than four hundred times.
//   tspPath          one unbroken path through a point set. The plotter's signature gesture: zero
//                    pen lifts, the whole picture in a single stroke.
//
// Everything is pure, deterministic given a seeded rng, and works on a plain
// { w, h, lum: Float32Array } tone field, where lum is 0 (black, maximum ink) to 1 (paper). That
// keeps every algorithm here testable in node against a synthetic field, with no canvas, no image
// decoder, and no GPU: the browser's only job is to hand over pixels.
//
// Coordinates are IMAGE PIXELS throughout. Mapping onto the sheet happens once, at the end, in
// plot-image-studies.js — because a sheet's normalized space is anisotropic whenever the paper
// isn't square, and doing geometry in it would quietly skew every angle.

// ── the field ───────────────────────────────────────────────────────────────
export function toneField(pixels, w, h, ch = 4) {
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < lum.length; i += 1, p += ch) {
    lum[i] = (pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114) / 255;
  }
  return { w, h, lum };
}

export const inkAt = (field, x, y) => 1 - field.lum[
  Math.max(0, Math.min(field.h - 1, y | 0)) * field.w + Math.max(0, Math.min(field.w - 1, x | 0))
];

export function sampleField(field, x, y) {
  // Bilinear. Sub-pixel accuracy matters: a stroke walks in fractions of a pixel, and nearest
  // sampling makes the walk stair-step visibly at plot resolution.
  const { w, h, lum } = field;
  const cx = Math.max(0, Math.min(w - 1.001, x)), cy = Math.max(0, Math.min(h - 1.001, y));
  const x0 = cx | 0, y0 = cy | 0, fx = cx - x0, fy = cy - y0;
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const a = lum[y0 * w + x0], b = lum[y0 * w + x1], c = lum[y1 * w + x0], d = lum[y1 * w + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

// Box-average downsample. A plot runs at a few hundred pixels on the long edge; feeding a 1536px
// photo straight in costs 30x the work and adds detail no pen can render. Averaging (rather than
// dropping) pixels is what keeps fine texture as TONE instead of as noise.
export function resampleField(field, tw, th) {
  const { w, h, lum } = field;
  tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th));
  if (tw === w && th === h) return { w, h, lum: lum.slice() };
  const out = new Float32Array(tw * th);
  for (let y = 0; y < th; y += 1) {
    const y0 = Math.floor((y * h) / th), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / th));
    for (let x = 0; x < tw; x += 1) {
      const x0 = Math.floor((x * w) / tw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / tw));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy += 1) {
        for (let xx = x0; xx < x1 && xx < w; xx += 1) { s += lum[yy * w + xx]; n += 1; }
      }
      out[y * tw + x] = n ? s / n : 0;
    }
  }
  return { w: tw, h: th, lum: out };
}

export function fitField(field, maxEdge) {
  const long = Math.max(field.w, field.h);
  if (long <= maxEdge) return { w: field.w, h: field.h, lum: field.lum.slice() };
  const k = maxEdge / long;
  return resampleField(field, Math.round(field.w * k), Math.round(field.h * k));
}

// Levels. A pen has one ink and no dynamic range to spare, so the tonal decision is made HERE,
// on the field, not later by hoping the stroke density works out. With no explicit black/white
// point the ends are found from the histogram (clip% at each end), which is what makes a flat
// phone photo plot with any contrast at all.
export function levels(field, opts = {}) {
  const { w, h, lum } = field;
  let lo = opts.black, hi = opts.white;
  if (lo == null || hi == null) {
    const bins = new Int32Array(256);
    for (let i = 0; i < lum.length; i += 1) bins[Math.max(0, Math.min(255, Math.round(lum[i] * 255)))] += 1;
    const clip = Math.max(1, Math.round(lum.length * (opts.clip == null ? 0.01 : opts.clip)));
    let acc = 0, a = 0, b = 255;
    for (let i = 0; i < 256; i += 1) { acc += bins[i]; if (acc >= clip) { a = i; break; } }
    acc = 0;
    for (let i = 255; i >= 0; i -= 1) { acc += bins[i]; if (acc >= clip) { b = i; break; } }
    if (lo == null) lo = a / 255;
    if (hi == null) hi = b / 255;
  }
  const span = Math.max(1e-4, hi - lo);
  const g = opts.gamma == null ? 1 : Math.max(0.05, opts.gamma);
  const out = new Float32Array(lum.length);
  for (let i = 0; i < lum.length; i += 1) {
    let v = (lum[i] - lo) / span;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    if (g !== 1) v = Math.pow(v, g);
    out[i] = opts.invert ? 1 - v : v;
  }
  return { w, h, lum: out };
}

function boxPass(src, w, h, r, horizontal) {
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  if (horizontal) {
    for (let y = 0; y < h; y += 1) {
      const row = y * w;
      let acc = 0;
      for (let i = -r; i <= r; i += 1) acc += src[row + Math.max(0, Math.min(w - 1, i))];
      for (let x = 0; x < w; x += 1) {
        out[row + x] = acc / n;
        acc -= src[row + Math.max(0, Math.min(w - 1, x - r))];
        acc += src[row + Math.max(0, Math.min(w - 1, x + r + 1))];
      }
    }
  } else {
    for (let x = 0; x < w; x += 1) {
      let acc = 0;
      for (let i = -r; i <= r; i += 1) acc += src[Math.max(0, Math.min(h - 1, i)) * w + x];
      for (let y = 0; y < h; y += 1) {
        out[y * w + x] = acc / n;
        acc -= src[Math.max(0, Math.min(h - 1, y - r)) * w + x];
        acc += src[Math.max(0, Math.min(h - 1, y + r + 1)) * w + x];
      }
    }
  }
  return out;
}

// Three box passes approximate a Gaussian closely enough for a DoG and cost O(n) per pass instead
// of O(n·kernel). `radius` reads as sigma.
export function blurField(field, radius) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return { w: field.w, h: field.h, lum: field.lum.slice() };
  let cur = field.lum;
  for (let pass = 0; pass < 3; pass += 1) {
    cur = boxPass(cur, field.w, field.h, r, true);
    cur = boxPass(cur, field.w, field.h, r, false);
  }
  return { w: field.w, h: field.h, lum: cur };
}

export function sobelField(field) {
  const { w, h, lum } = field;
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  const at = (x, y) => lum[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      gx[y * w + x] = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
        - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      gy[y * w + x] = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
        - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    }
  }
  return { w, h, gx, gy };
}

// ── the flow field ──────────────────────────────────────────────────────────
// The structure tensor, smoothed, then decomposed. Two things about this are load-bearing:
//
//   1. The TENSOR is smoothed, never the angle. Gradient directions are orientations mod pi, so
//      averaging the angles of two sides of the same edge cancels them to noise; averaging the
//      outer products does not. This is the entire reason the structure tensor exists and it is
//      the difference between a coherent field and static.
//   2. The stroke direction is the MINOR eigenvector — perpendicular to the gradient, along the
//      isophote. Hatching along the gradient would cut across every form in the picture.
//
// `coherence` is (l1-l2)/(l1+l2): 1 where the field has one clear direction, 0 in flat or
// isotropic regions. Methods use it to stop drawing confident strokes where there is no structure.
export function edgeTangentFlow(field, opts = {}) {
  const sigma = opts.sigma == null ? 4 : opts.sigma;
  const { w, h } = field;
  const { gx, gy } = sobelField(field);
  const E = new Float32Array(w * h), F = new Float32Array(w * h), G = new Float32Array(w * h);
  for (let i = 0; i < E.length; i += 1) { E[i] = gx[i] * gx[i]; F[i] = gx[i] * gy[i]; G[i] = gy[i] * gy[i]; }
  const bE = blurField({ w, h, lum: E }, sigma).lum;
  const bF = blurField({ w, h, lum: F }, sigma).lum;
  const bG = blurField({ w, h, lum: G }, sigma).lum;
  const angle = new Float32Array(w * h), coherence = new Float32Array(w * h);
  for (let i = 0; i < angle.length; i += 1) {
    const e = bE[i], f = bF[i], g = bG[i];
    const d = Math.sqrt(Math.max(0, (e - g) * (e - g) + 4 * f * f));
    const l1 = (e + g + d) / 2, l2 = (e + g - d) / 2;
    // Major eigenvector (the gradient direction). Two algebraic forms exist — (f, l1-g ... ) and
    // (l1-g, f) — and EACH degenerates to (0,0) on one axis: a diagonal tensor (an exactly
    // vertical or horizontal edge) zeroes one of them. Taking whichever came out longer covers
    // both, which matters because axis-aligned edges are the most common edges there are.
    const ax = f, ay = l1 - e;
    const bx = l1 - g, by = f;
    let vx, vy;
    if (ax * ax + ay * ay >= bx * bx + by * by) { vx = ax; vy = ay; } else { vx = bx; vy = by; }
    if (Math.abs(vx) < 1e-12 && Math.abs(vy) < 1e-12) { vx = 0; vy = 1; }   // isotropic: any direction
    // The stroke runs perpendicular to the gradient: rotate (vx, vy) by 90° to (-vy, vx).
    angle[i] = Math.atan2(vx, -vy);
    coherence[i] = l1 + l2 > 1e-12 ? (l1 - l2) / (l1 + l2) : 0;
  }
  return { w, h, angle, coherence };
}

export const angleAt = (etf, x, y) => etf.angle[
  Math.max(0, Math.min(etf.h - 1, Math.round(y))) * etf.w + Math.max(0, Math.min(etf.w - 1, Math.round(x)))
];
export const coherenceAt = (etf, x, y) => etf.coherence[
  Math.max(0, Math.min(etf.h - 1, Math.round(y))) * etf.w + Math.max(0, Math.min(etf.w - 1, Math.round(x)))
];

// ── the line response ───────────────────────────────────────────────────────
// The LINE component of XDoG. Winnemöller's full operator thresholds the sharpened image
// absolutely, which fills every dark MASS with ink — the right look for his stylization, the
// wrong input for a line tracer, which wants edges and only edges (mass is the tone methods'
// job). The line component is the band-pass part alone: s = tau·(G_sigma − G_k·sigma), which is
// identically zero in flat regions at ANY grey level and swings negative on the dark side of an
// edge. That side ramps into ink through the same soft tanh, so a walk can feel where a line
// FADES rather than where it stops, and a single edge answers once — no Canny double response.
export function xdogField(field, opts = {}) {
  const sigma = opts.sigma == null ? 1 : opts.sigma;
  const k = opts.k == null ? 1.6 : opts.k;
  const tau = opts.tau == null ? 1 : opts.tau;
  const eps = opts.eps == null ? 0.01 : opts.eps;   // noise floor, in band-pass units
  const phi = opts.phi == null ? 24 : opts.phi;
  const a = blurField(field, sigma).lum;
  const b = blurField(field, sigma * k).lum;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    const s = tau * (a[i] - b[i]);
    out[i] = s < -eps ? Math.min(1, -Math.tanh(phi * (s + eps))) : 0;
  }
  return { w: field.w, h: field.h, lum: out };
}

/**
 * traceFlowLines(strength, etf, opts) → polylines in image pixels.
 * Walks the flow field outward from the strongest responses. A coverage grid at `spacing` pixels
 * claims the ground a stroke has already drawn, so one edge yields one stroke rather than one per
 * pixel along it — without it a 400px face produces 90,000 overlapping lines and a 60MB SVG.
 */
export function traceFlowLines(strength, etf, opts = {}) {
  const { w, h } = strength;
  const step = opts.step == null ? 1 : opts.step;
  const maxSteps = opts.maxSteps == null ? 120 : opts.maxSteps;
  const seedMin = opts.seedMin == null ? 0.22 : opts.seedMin;
  const dropAt = opts.dropAt == null ? seedMin * 0.45 : opts.dropAt;
  const spacing = Math.max(1, opts.spacing == null ? 2 : opts.spacing);
  const cap = opts.maxLines == null ? 4000 : opts.maxLines;
  const minPts = opts.minPoints == null ? 4 : opts.minPoints;

  const gw = Math.ceil(w / spacing), gh = Math.ceil(h / spacing);
  const taken = new Uint8Array(gw * gh);
  const claim = (x, y) => {
    const k = Math.min(gh - 1, Math.max(0, Math.floor(y / spacing))) * gw
      + Math.min(gw - 1, Math.max(0, Math.floor(x / spacing)));
    taken[k] = 1;
  };
  const isTaken = (x, y) => taken[
    Math.min(gh - 1, Math.max(0, Math.floor(y / spacing))) * gw
    + Math.min(gw - 1, Math.max(0, Math.floor(x / spacing)))
  ] === 1;

  // Strongest first, ties broken by index: the order is a property of the image, not of the clock.
  const idx = [];
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const s = strength.lum[y * w + x];
      if (s >= seedMin) idx.push([s, y * w + x]);
    }
  }
  idx.sort((p, q) => q[0] - p[0] || p[1] - q[1]);

  const walk = (x0, y0, dir) => {
    const pts = [[x0, y0]];
    let x = x0, y = y0;
    const a0 = angleAt(etf, x, y);
    let px = Math.cos(a0) * dir, py = Math.sin(a0) * dir;
    for (let s = 0; s < maxSteps; s += 1) {
      const a = angleAt(etf, x, y);
      let tx = Math.cos(a), ty = Math.sin(a);
      // The field carries ORIENTATION, not direction: without this flip the walk reverses itself
      // wherever the eigenvector's sign happens to change and the stroke folds back on its path.
      if (tx * px + ty * py < 0) { tx = -tx; ty = -ty; }
      x += tx * step; y += ty * step;
      px = tx; py = ty;
      if (x < 0.5 || y < 0.5 || x > w - 1.5 || y > h - 1.5) break;
      if (sampleField(strength, x, y) < dropAt) break;
      pts.push([x, y]);
    }
    return pts;
  };

  const lines = [];
  for (const [, at] of idx) {
    if (lines.length >= cap) break;
    const sx = at % w, sy = (at - (at % w)) / w;
    if (isTaken(sx, sy)) continue;
    const fwd = walk(sx, sy, 1), bwd = walk(sx, sy, -1);
    const line = bwd.slice(1).reverse().concat(fwd);
    if (line.length < minPts) { claim(sx, sy); continue; }
    for (const [x, y] of line) claim(x, y);
    lines.push(line);
  }
  return lines;
}

/**
 * evenStreamlines(field, etf, opts) → polylines in image pixels.
 *
 * Jobard & Lefer's evenly-spaced streamline placement (1997), with the separation driven by the
 * image instead of held constant. This is the method that makes a plotted photograph read as an
 * ENGRAVING rather than as a filter: every stroke follows the flow field, and tone comes from how
 * close the strokes are allowed to sit — tight in the shadows, open in the light. One ink, one
 * pen, the whole tonal range from spacing alone, which is exactly how a burin does it.
 *
 * The algorithm: trace a streamline, then offer new seeds perpendicular to it at the local
 * separation, tracing each in turn and stopping any line that comes closer than `dTest` of the
 * separation to a line already drawn. The result has no gaps and no overlaps, which neither
 * random seeding (clumps and bald patches) nor a fixed lattice (a visible grid) can give.
 */
export function evenStreamlines(field, etf, opts = {}) {
  const { w, h } = field;
  const sepMin = opts.sepMin == null ? 1.7 : opts.sepMin;
  const sepMax = opts.sepMax == null ? 9 : opts.sepMax;
  const offset = opts.offset || 0;
  const step = opts.step == null ? 1 : opts.step;
  const maxSteps = opts.maxSteps == null ? 320 : opts.maxSteps;
  const inkMin = opts.inkMin == null ? 0.05 : opts.inkMin;
  const dTest = opts.dTest == null ? 0.62 : opts.dTest;
  const maxLines = opts.maxLines == null ? 5000 : opts.maxLines;
  const minPoints = opts.minPoints == null ? 3 : opts.minPoints;

  const inkOf = (x, y) => 1 - sampleField(field, x, y);
  const sepAt = (x, y) => sepMax - (sepMax - sepMin) * Math.max(0, Math.min(1, inkOf(x, y)));

  const cell = Math.max(1, sepMax);
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const buckets = new Map();
  const bkey = (x, y) => Math.min(gh - 1, Math.max(0, Math.floor(y / cell))) * gw
    + Math.min(gw - 1, Math.max(0, Math.floor(x / cell)));
  const put = (x, y) => {
    const k = bkey(x, y);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(x, y);
  };
  const nearer = (x, y, d) => {
    const gx = Math.min(gw - 1, Math.max(0, Math.floor(x / cell)));
    const gy = Math.min(gh - 1, Math.max(0, Math.floor(y / cell)));
    const dd = d * d;
    for (let j = gy - 1; j <= gy + 1; j += 1) {
      if (j < 0 || j >= gh) continue;
      for (let i = gx - 1; i <= gx + 1; i += 1) {
        if (i < 0 || i >= gw) continue;
        const list = buckets.get(j * gw + i);
        if (!list) continue;
        for (let p = 0; p < list.length; p += 2) {
          const ex = list[p] - x, ey = list[p + 1] - y;
          if (ex * ex + ey * ey < dd) return true;
        }
      }
    }
    return false;
  };

  // Self-termination: a line must also stop when it approaches ITSELF, or a closed isophote (a
  // circle around a peak) wraps two and a half laps and double-inks its own path. The check skips
  // the line's most recent points (a stroke is always "near" its own tail) and, for the backward
  // half, sees the forward half's far end — so a closed loop is drawn exactly once: forward until
  // it meets its own start, backward not at all.
  const SKIP = Math.ceil((2.5 * sepMax) / step);
  const selfNear = (x, y, pts, skipRecent) => {
    const lim = pts.length - skipRecent;
    const d = sepAt(x, y) * dTest, dd = d * d;
    for (let i = 0; i < lim; i += 1) {
      const ex = pts[i][0] - x, ey = pts[i][1] - y;
      if (ex * ex + ey * ey < dd) return true;
    }
    return false;
  };
  // Field direction at a point, sign-matched to the previous heading (the field carries
  // orientation, not direction).
  const dirAt = (x, y, px, py) => {
    const a = angleAt(etf, x, y) + offset;
    let tx = Math.cos(a), ty = Math.sin(a);
    if (tx * px + ty * py < 0) { tx = -tx; ty = -ty; }
    return [tx, ty];
  };
  const trace = (x0, y0) => {
    const half = (dir, ctxPts) => {
      const pts = [];
      let x = x0, y = y0;
      const a0 = angleAt(etf, x, y) + offset;
      let px = Math.cos(a0) * dir, py = Math.sin(a0) * dir;
      for (let s = 0; s < maxSteps; s += 1) {
        // Midpoint (RK2) integration, as in Jobard & Lefer. Plain Euler drifts OUTWARD on any
        // curved isophote by step²/2r per step — 3px per lap on an r=8 circle — so closed loops
        // came back as widening spirals that never met their own tail and double-inked whole
        // annuli. One midpoint resample cuts the drift below the self-stop distance.
        const [t1x, t1y] = dirAt(x, y, px, py);
        const [t2x, t2y] = dirAt(x + t1x * step * 0.5, y + t1y * step * 0.5, t1x, t1y);
        x += t2x * step; y += t2y * step;
        px = t2x; py = t2y;
        if (x < 0.5 || y < 0.5 || x > w - 1.5 || y > h - 1.5) break;
        if (inkOf(x, y) < inkMin) break;
        if (nearer(x, y, sepAt(x, y) * dTest)) break;
        if (selfNear(x, y, pts, SKIP)) break;
        if (ctxPts && selfNear(x, y, ctxPts, SKIP)) break;
        pts.push([x, y]);
      }
      return pts;
    };
    const fwd = half(1, null), bwd = half(-1, fwd);
    return bwd.reverse().concat([[x0, y0]], fwd);
  };

  // The first seed is the darkest point on a coarse scan, so the placement starts where the
  // picture has the most to say and grows outward. Deterministic, and independent of any rng.
  let sx = w / 2, sy = h / 2, bestInk = -1;
  for (let y = 2; y < h - 2; y += 3) {
    for (let x = 2; x < w - 2; x += 3) {
      const ink = 1 - field.lum[y * w + x];
      if (ink > bestInk) { bestInk = ink; sx = x; sy = y; }
    }
  }
  const queue = [[sx, sy]];
  const lines = [];
  let head = 0;
  while (head < queue.length && lines.length < maxLines) {
    const [qx, qy] = queue[head]; head += 1;
    if (qx < 1 || qy < 1 || qx > w - 2 || qy > h - 2) continue;
    if (inkOf(qx, qy) < inkMin) continue;
    if (nearer(qx, qy, sepAt(qx, qy) * dTest)) continue;
    const line = trace(qx, qy);
    if (line.length < minPoints) continue;
    for (const [x, y] of line) put(x, y);
    lines.push(line);
    // Offer perpendicular seeds along the new line at its local separation. Sampling every few
    // points (rather than every point) keeps the queue proportional to the ink, not to the walk.
    for (let i = 0; i < line.length; i += 3) {
      const [x, y] = line[i];
      const a = angleAt(etf, x, y) + offset;
      const nx = -Math.sin(a), ny = Math.cos(a);
      const d = sepAt(x, y);
      queue.push([x + nx * d, y + ny * d], [x - nx * d, y - ny * d]);
    }
  }
  return lines;
}

/**
 * stipplePoints(field, opts) → points in image pixels, denser where the image is darker.
 * Rejection sampling against ink, then a few relaxation rounds that push cell-mates apart. The
 * relaxation is what turns a random draw into TONE: unrelaxed points clump, and a clump reads as
 * a blot rather than as a grey.
 */
export function stipplePoints(field, rng, opts = {}) {
  const count = Math.max(20, Math.min(60000, Math.round(opts.count || 6000)));
  const gamma = opts.gamma == null ? 1.35 : opts.gamma;
  const relax = opts.relax == null ? 3 : opts.relax;
  const { w, h } = field;
  const pts = [];
  let guard = count * 30;
  while (pts.length < count && guard-- > 0) {
    const x = rng() * (w - 1), y = rng() * (h - 1);
    if (rng() < Math.pow(1 - sampleField(field, x, y), gamma)) pts.push([x, y]);
  }
  const cells = Math.max(6, Math.round(Math.sqrt(pts.length / 2.2)));
  const cw = w / cells, chh = h / cells;
  for (let it = 0; it < relax; it += 1) {
    const grid = new Map();
    for (const p of pts) {
      const k = Math.min(cells - 1, Math.floor(p[0] / cw)) * cells + Math.min(cells - 1, Math.floor(p[1] / chh));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(p);
    }
    for (const group of grid.values()) {
      if (group.length < 2) continue;
      let cx = 0, cy = 0;
      for (const p of group) { cx += p[0]; cy += p[1]; }
      cx /= group.length; cy /= group.length;
      for (const p of group) {
        p[0] = Math.max(0, Math.min(w - 1, p[0] + (p[0] - cx) * 0.3));
        p[1] = Math.max(0, Math.min(h - 1, p[1] + (p[1] - cy) * 0.3));
      }
    }
  }
  return pts;
}

/**
 * tspPath(points) → one polyline visiting every point.
 * Nearest-neighbour over a bucket grid, then windowed 2-opt. This is TSP art: the whole picture
 * as a single unbroken stroke, the one thing a pen plotter does that no printer can. The tour is
 * not optimal and does not need to be — 2-opt removes the long crossings that read as mistakes,
 * and what remains is the wandering line the technique is named for.
 */
export function tspPath(points, opts = {}) {
  const n = points.length;
  if (n < 2) return points.slice();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const side = Math.max(1e-6, Math.sqrt(((maxX - minX) * (maxY - minY) || 1) / n));
  const gw = Math.max(1, Math.ceil((maxX - minX) / side) + 1);
  const gh = Math.max(1, Math.ceil((maxY - minY) / side) + 1);
  const buckets = new Map();
  const key = (gx, gy) => gy * gw + gx;
  points.forEach((p, i) => {
    const gx = Math.min(gw - 1, Math.floor((p[0] - minX) / side));
    const gy = Math.min(gh - 1, Math.floor((p[1] - minY) / side));
    const k = key(gx, gy);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  const used = new Uint8Array(n);
  const tour = [0];
  used[0] = 1;
  let cur = 0;
  for (let visited = 1; visited < n; visited += 1) {
    const [cxp, cyp] = points[cur];
    const cgx = Math.min(gw - 1, Math.floor((cxp - minX) / side));
    const cgy = Math.min(gh - 1, Math.floor((cyp - minY) / side));
    let best = -1, bestD = Infinity;
    // Expand rings until a candidate is found AND the ring's inner radius exceeds the best
    // distance so far — stopping at the first hit would take a point in a far corner of a near
    // bucket over a closer point one ring out.
    for (let r = 0; r < Math.max(gw, gh); r += 1) {
      if (best >= 0 && (r - 1) * side > bestD) break;
      for (let gy = cgy - r; gy <= cgy + r; gy += 1) {
        if (gy < 0 || gy >= gh) continue;
        for (let gx = cgx - r; gx <= cgx + r; gx += 1) {
          if (gx < 0 || gx >= gw) continue;
          if (r > 0 && Math.abs(gx - cgx) !== r && Math.abs(gy - cgy) !== r) continue;
          const list = buckets.get(key(gx, gy));
          if (!list) continue;
          for (const i of list) {
            if (used[i]) continue;
            const d = Math.hypot(points[i][0] - cxp, points[i][1] - cyp);
            if (d < bestD) { bestD = d; best = i; }
          }
        }
      }
    }
    if (best < 0) { for (let i = 0; i < n; i += 1) if (!used[i]) { best = i; break; } }
    if (best < 0) break;
    used[best] = 1; tour.push(best); cur = best;
  }
  // Windowed 2-opt: full 2-opt is O(n^2) per sweep and unusable at 20,000 points, but the
  // crossings that actually hurt are local, so a sliding window catches nearly all of them.
  const W = Math.max(4, Math.min(64, opts.window == null ? 32 : opts.window));
  const sweeps = Math.max(0, Math.min(6, opts.sweeps == null ? 2 : opts.sweeps));
  const d2 = (a, b) => {
    const dx = points[a][0] - points[b][0], dy = points[a][1] - points[b][1];
    return Math.hypot(dx, dy);
  };
  for (let s = 0; s < sweeps; s += 1) {
    let improved = false;
    for (let i = 0; i + 2 < tour.length; i += 1) {
      const lim = Math.min(tour.length - 2, i + W);
      for (let j = i + 2; j <= lim; j += 1) {
        const a = tour[i], b = tour[i + 1], c = tour[j], dd = tour[j + 1];
        if (d2(a, b) + d2(c, dd) > d2(a, c) + d2(b, dd) + 1e-12) {
          let lo = i + 1, hi = j;
          while (lo < hi) { const t = tour[lo]; tour[lo] = tour[hi]; tour[hi] = t; lo += 1; hi -= 1; }
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return tour.map((i) => points[i]);
}

// A field back to RGBA bytes, so the marching-squares contour tracer in plotter.js can be reused
// verbatim rather than reimplemented. One iso-line algorithm in the codebase, already tested.
export function fieldToRGBA(field) {
  const px = new Uint8ClampedArray(field.w * field.h * 4);
  for (let i = 0, p = 0; i < field.lum.length; i += 1, p += 4) {
    const v = Math.max(0, Math.min(255, Math.round(field.lum[i] * 255)));
    px[p] = v; px[p + 1] = v; px[p + 2] = v; px[p + 3] = 255;
  }
  return px;
}

/**
 * sheetPlacement(imgW, imgH, margin) → { aspect, rect, place }
 * The sheet takes the PICTURE's aspect, so nothing is letterboxed and nothing is stretched: the
 * paper is cut to the image. `rect` is the content area in normalized sheet coordinates and
 * `place` maps an image pixel into it. Because the sheet aspect equals the image aspect, the
 * content rect is square in normalized units even though the paper is not — that identity is what
 * keeps angles honest through the mapping.
 */
export function sheetPlacement(imgW, imgH, margin = 0.045) {
  const aspect = imgH / imgW;
  const side = 1 - 2 * margin;
  const rect = { x: margin, y: margin, w: side, h: side };
  const place = (px, py) => [rect.x + (px / imgW) * rect.w, rect.y + (py / imgH) * rect.h];
  return { aspect, rect, place };
}
