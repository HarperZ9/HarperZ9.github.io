/* glitch-ops-wave2-temporal.js — TEMPORAL AND SIGNAL.

   Six ops that behave like a broken transmission and like time, not like added
   noise. Same contract as glitch-ops.js: fn(canvas, p) mutates the canvas in
   place, so they compose in any order and merge straight into OPS / OP_META.
   `p` carries { amount, seed, phase, ... } exactly as the effects rack builds
   it, one amount in [0,1] takes each op from a whisper to a scream, and every
   random number comes from the seed. Zero dependencies, pure canvas 2D.

   The faults they follow:
     rollingShutter  the sensor clock reads one row at a time, so every scanline
                     belongs to a different moment: drift, shear, one hard step
     vhsTracking     chroma runs a leaky integrator left to right (colour lags
                     its edge, luma stays sharp), bands lose lock, the heads
                     hand over in a torn monochrome strip at the bottom
     frameEcho       multipath: the same picture arriving late and again, each
                     repeat weaker, older repeats losing colour before shape
     dropout         the tape loses contact: black runs with the hot leading
                     edge, stuck blocks stamped across a run, held stale lines
     interlace       two fields captured a moment apart, woven back together,
                     the lagging field offset and a shade darker
     timeWarp        a slit scan folded into two dimensions: a smooth seeded
                     field decides how far into the past each region is

   The PRNG helper is restated here rather than imported, to keep the module
   standalone; the arithmetic is identical to glitch-ops.js, so one seed yields
   the same stream in both. */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rngFrom(seed) {
  if (typeof seed === "function") return seed;
  let h = 2166136261; const s = String(seed == null ? 1 : seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
}

const scratch = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const cl255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// Seeded lattice noise. The lattice is filled from the op's own rng, so the
// field moves with the seed (the fbm in glitch-ops.js is seed-independent by
// design; a transmission fault should not be).
function lat1(rng, n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = rng(); return a; }
function lat2(rng, n) { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng(); return a; }
const wrapi = (i, n) => ((i % n) + n) % n;
const smooth = (f) => f * f * (3 - 2 * f);
function s1(L, n, x) {
  const xi = Math.floor(x), f = smooth(x - xi);
  const a = L[wrapi(xi, n)], b = L[wrapi(xi + 1, n)];
  return a + (b - a) * f;
}
function s2(L, n, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const i0 = wrapi(xi, n), j0 = wrapi(yi, n), i1 = wrapi(xi + 1, n), j1 = wrapi(yi + 1, n);
  const a = L[j0 * n + i0], b = L[j0 * n + i1], c = L[j1 * n + i0], d = L[j1 * n + i1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// Every op starts here: no canvas, no context, no amount, no work.
function dims(canvas, p, minH) {
  if (!canvas || !canvas.width || !canvas.height) return null;
  const w = canvas.width | 0, h = canvas.height | 0;
  if (w < 2 || h < (minH || 2)) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const a = clamp01(p.amount ?? 0.5);
  if (a <= 0.002) return null;
  return { ctx, w, h, a, t: p.phase ?? 0 };
}
const copyOf = (canvas, w, h) => { const c = scratch(w, h); c.getContext("2d").drawImage(canvas, 0, 0); return c; };

// ---------------------------------------------------------------------------
// rollingShutter — the sensor clock reads one row at a time, so every scanline
// belongs to a slightly different moment. A seeded low-frequency drift shears
// the frame, one hard step marks the row where the exposure jumped, and each
// band also samples a neighbouring row: the moment it actually caught. Rows
// sharing an offset draw as one band, so the cost is bands, not rows.
// ---------------------------------------------------------------------------
export function rollingShutter(canvas, p = {}) {
  const D = dims(canvas, p, 4); if (!D) return;
  const { ctx, w, h, a, t } = D;
  const rng = rngFrom((p.seed || "roll") + "|shutter");
  const tmp = copyOf(canvas, w, h);
  const N = 16, L = lat1(rng, N);
  const jumpAt = 0.12 + rng() * 0.74;               // the row the read glitched
  const jumpMag = (rng() * 2 - 1) * 0.55;
  const maxShift = a * w * 0.20;                    // lateral tear
  const skew = a * 0.055 * w;                       // steady shear, top to bottom
  const rowJit = a * 5;                             // rows sampled off their moment
  const lim = w - 1;
  const DX = new Int32Array(h), OF = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    let n = s1(L, N, v * 2.3 + t * 0.11) - 0.5;
    n += (s1(L, N, v * 5.7 - t * 0.07) - 0.5) * 0.45;
    const step = v > jumpAt ? jumpMag : 0;
    let dx = Math.round((n + step) * maxShift + (v - 0.5) * skew);
    if (dx > lim) dx = lim; else if (dx < -lim) dx = -lim;
    DX[y] = dx;
    OF[y] = Math.round(n * rowJit);
  }
  let y = 0;
  while (y < h) {
    const dx = DX[y], of = OF[y];
    let y2 = y + 1;
    while (y2 < h && DX[y2] === dx && OF[y2] === of) y2++;
    const bh = y2 - y;
    let sy = y + of;
    if (sy < 0) sy = 0; else if (sy > h - bh) sy = h - bh;
    ctx.drawImage(tmp, 0, sy, w, bh, dx, y, w, bh);
    if (dx > 0) ctx.drawImage(tmp, w - dx, sy, dx, bh, 0, y, dx, bh);
    else if (dx < 0) ctx.drawImage(tmp, 0, sy, -dx, bh, w + dx, y, -dx, bh);
    y = y2;
  }
}

// ---------------------------------------------------------------------------
// vhsTracking — three faults of one machine, in a single pass plus a few band
// draws. Chroma runs through a leaky integrator left to right, so colour lags
// behind its edge and trails to the right while luma stays sharp: that is the
// real bandwidth split of a composite recording, not a blur of everything.
// Seeded bands lose lock, luma washes up and the rows slide. The bottom carries
// the head-switching strip, torn and dropped to monochrome hash where the heads
// hand over below the picture.
// ---------------------------------------------------------------------------
export function vhsTracking(canvas, p = {}) {
  const D = dims(canvas, p, 8); if (!D) return;
  const { ctx, w, h, a } = D;
  const rng = rngFrom((p.seed || "vhs") + "|track");
  const lag = 1 / (1 + a * 26);                     // 1 = locked, small = long trail
  const gain = new Float32Array(h), lift = new Float32Array(h);
  gain.fill(1);
  const bands = [], bn = 1 + Math.round(a * 3);
  for (let b = 0; b < bn; b++) {
    const bh = Math.max(2, Math.round(h * (0.012 + rng() * 0.06 * a)));
    const y0 = Math.min(h - bh, Math.floor(rng() * h));
    const shift = Math.round((rng() * 2 - 1) * a * w * 0.13);
    bands.push([y0, bh, shift]);
    for (let y = y0; y < y0 + bh; y++) {
      const e = 1 - Math.abs((y - y0) / bh - 0.5) * 2;      // soft through the band
      gain[y] = 1 + a * 0.45 * e;
      lift[y] = a * 46 * e;
    }
  }
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const base = y * w * 4, g = gain[y], lf = lift[y];
    let u = 0, v = 0, primed = false;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      const Y = 0.299 * R + 0.587 * G + 0.114 * B;
      const cu = B - Y, cv = R - Y;                          // U and V, before the lag
      if (!primed) { u = cu; v = cv; primed = true; }
      else { u += (cu - u) * lag; v += (cv - v) * lag; }
      const yy = Y * g + lf;
      d[i] = cl255(yy + v);
      d[i + 1] = cl255(yy - (0.299 * v + 0.114 * u) / 0.587);
      d[i + 2] = cl255(yy + u);
    }
  }
  ctx.putImageData(img, 0, 0);
  // second pass: slide the unlocked bands, then tear the head-switch strip
  const tmp = copyOf(canvas, w, h), lim = w - 1;
  for (let b = 0; b < bands.length; b++) {
    const y0 = bands[b][0], bh = bands[b][1];
    let sh = bands[b][2];
    if (sh > lim) sh = lim; else if (sh < -lim) sh = -lim;
    if (!sh) continue;
    ctx.drawImage(tmp, 0, y0, w, bh, sh, y0, w, bh);
    if (sh > 0) ctx.drawImage(tmp, w - sh, y0, sh, bh, 0, y0, sh, bh);
    else ctx.drawImage(tmp, 0, y0, -sh, bh, w + sh, y0, -sh, bh);
  }
  const hs = Math.max(2, Math.round(h * (0.02 + a * 0.05)));
  const dir = rng() > 0.5 ? 1 : -1;
  for (let k = 0; k < hs; k++) {
    const y = h - hs + k, f = k / hs;
    let dx = Math.round(dir * a * w * (0.06 + 0.5 * f * f));
    if (dx > lim) dx = lim; else if (dx < -lim) dx = -lim;
    ctx.drawImage(tmp, 0, y, w, 1, dx, y, w, 1);
    if (dx > 0) ctx.drawImage(tmp, w - dx, y, dx, 1, 0, y, dx, 1);
    else if (dx < 0) ctx.drawImage(tmp, 0, y, -dx, 1, w + dx, y, -dx, 1);
  }
  const dashes = Math.round(hs * (1 + a * 6));
  for (let k = 0; k < dashes; k++) {
    const y = h - hs + Math.floor(rng() * hs);
    const x = Math.floor(rng() * w), ww = 2 + Math.floor(rng() * w * 0.18);
    const g = 30 + Math.floor(rng() * 200);
    ctx.fillStyle = "rgba(" + g + "," + g + "," + g + "," + (0.25 + 0.55 * rng() * a).toFixed(3) + ")";
    ctx.fillRect(x, y, ww, 1);
  }
}

// ---------------------------------------------------------------------------
// frameEcho — multipath: the same picture arriving late, again and again, each
// repeat weaker and further along the seeded ghost path. Opacity falls
// geometrically, so the source stays the brightest thing in the frame. The taps
// desaturate and dim as they age, the way a reflected signal loses its colour
// before it loses its shape.
// ---------------------------------------------------------------------------
export function frameEcho(canvas, p = {}) {
  const D = dims(canvas, p, 2); if (!D) return;
  const { ctx, w, h, a, t } = D;
  const rng = rngFrom((p.seed || "echo") + "|ghost");
  const tmp = copyOf(canvas, w, h);
  const taps = 2 + Math.round(a * 4);
  const ang = rng() * 6.2831853;
  const reach = a * Math.min(w, h) * 0.13 * (0.55 + rng() * 0.6);
  const breathe = 0.85 + 0.15 * Math.sin(t * 0.9);
  const dx = Math.cos(ang) * reach * 1.5 * breathe;     // mostly lateral, like a real ghost
  const dy = Math.sin(ang) * reach * 0.4 * breathe;
  const canFilter = typeof ctx.filter === "string";
  ctx.save();
  for (let k = 1; k <= taps; k++) {
    const al = a * 0.5 * Math.pow(0.56, k - 1);
    if (al < 0.01) break;
    ctx.globalAlpha = al;
    if (canFilter) {
      const sat = Math.max(0, 100 - k * 22 * (0.5 + a)), br = Math.max(0.35, 1 - k * 0.1);
      ctx.filter = "saturate(" + sat.toFixed(0) + "%) brightness(" + br.toFixed(2) + ")";
    }
    ctx.drawImage(tmp, dx * k, dy * k);
  }
  if (canFilter) ctx.filter = "none";
  ctx.restore();
}

// ---------------------------------------------------------------------------
// dropout — the tape loses contact. Seeded runs punch out: some go black with
// the hot leading edge a real dropout leaves, some freeze on the block to their
// left and stamp it across the run (a stuck macroblock), some hold a stale line
// from elsewhere in the frame. Run length is biased short by squaring the draw,
// so a low amount reads as flecks and a high one as whole missing lines.
// ---------------------------------------------------------------------------
export function dropout(canvas, p = {}) {
  const D = dims(canvas, p, 2); if (!D) return;
  const { ctx, w, h, a } = D;
  const rng = rngFrom((p.seed || "drop") + "|loss");
  const tmp = copyOf(canvas, w, h);
  const events = Math.max(1, Math.round(a * (6 + h * 0.16)));
  for (let e = 0; e < events; e++) {
    const rows = 1 + Math.floor(rng() * (1 + a * 7));
    const y = Math.min(h - rows, Math.floor(rng() * h));
    const full = rng() < 0.18 * a;
    const len = full ? w : Math.max(3, Math.round(w * (0.03 + rng() * rng() * 0.75 * a)));
    const x = full ? 0 : Math.min(w - len, Math.floor(rng() * w));
    const kind = rng();
    if (kind < 0.42) {
      ctx.fillStyle = "rgba(6,6,10," + (0.7 + 0.3 * a).toFixed(2) + ")";
      ctx.fillRect(x, y, len, rows);
      ctx.fillStyle = "rgba(226,226,232," + (0.25 + 0.5 * a).toFixed(2) + ")";
      ctx.fillRect(x, y, Math.min(3, len), rows);          // the hot edge where contact broke
    } else if (kind < 0.78) {
      const bw = Math.max(2, Math.round(len / (2 + Math.floor(rng() * 5))));
      const sx = Math.max(0, Math.min(w - bw, x - bw));
      const reps = Math.min(24, Math.ceil(len / bw));
      for (let r = 0; r < reps; r++) {
        const px = x + r * bw, pw = Math.min(bw, x + len - px);
        if (pw <= 0) break;
        ctx.drawImage(tmp, sx, y, pw, rows, px, y, pw, rows);
      }
    } else {
      const sy = Math.min(h - rows, Math.floor(rng() * h));
      ctx.drawImage(tmp, x, sy, len, rows, x, y, len, rows);
    }
  }
}

// ---------------------------------------------------------------------------
// interlace — two fields captured a moment apart, woven back together. The
// whole frame lands on the even field's offset, then every odd line is redrawn
// from where the picture sat on the other field, so vertical edges grow the
// teeth. One seeded band rolls twice as far: the moment the picture moved most.
// The lagging field also sits a shade darker, the flicker of a set showing you
// the seam. Dimming is one patterned fill, not a fill per line.
// ---------------------------------------------------------------------------
export function interlace(canvas, p = {}) {
  const D = dims(canvas, p, 4); if (!D) return;
  const { ctx, w, h, a, t } = D;
  const rng = rngFrom((p.seed || "field") + "|comb");
  const pitch = Math.max(1, Math.round(p.pitch ?? 1));      // source lines per field line
  const tmp = copyOf(canvas, w, h);
  const lim = w - 1;
  const drift = 0.62 + 0.38 * Math.sin(t * 0.9 + rng() * 6.2831853);
  let lead = Math.round(a * (2 + rng() * 11) * drift);
  if (lead < 1) lead = 1;
  if (lead > lim) lead = lim;
  let even = Math.round(lead * 0.32);
  if (even > lim) even = lim;
  const rb = Math.max(2, Math.round(h * (0.05 + rng() * 0.2)));
  const ry = Math.min(h - rb, Math.floor(rng() * h));
  ctx.drawImage(tmp, even, 0);
  if (even > 0) ctx.drawImage(tmp, w - even, 0, even, h, 0, 0, even, h);
  for (let y = pitch; y < h; y += pitch * 2) {
    const rows = Math.min(pitch, h - y);
    const dx = -(y >= ry && y < ry + rb ? Math.min(lim, lead * 2) : lead);
    ctx.drawImage(tmp, 0, y, w, rows, dx, y, w, rows);
    ctx.drawImage(tmp, 0, y, -dx, rows, w + dx, y, -dx, rows);
  }
  const dim = a * 0.2;
  if (dim > 0.01) {
    const pc = scratch(1, pitch * 2), pcx = pc.getContext("2d");
    pcx.fillStyle = "rgba(0,0,0," + dim.toFixed(3) + ")";
    pcx.fillRect(0, pitch, 1, pitch);
    const pat = ctx.createPattern(pc, "repeat");
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); }
  }
}

// ---------------------------------------------------------------------------
// timeWarp — a slit scan folded into two dimensions. A smooth seeded field
// decides, per region, how far into the past that part of the picture is, and
// the pixel is fetched from a neighbour along the local time direction, so the
// frame tears into zones each running its own clock. Chroma is dragged further
// than luma (colour was always the slower channel) and the deep-past regions
// sit a little darker. The field is built on a coarse grid and interpolated up,
// so this stays one pass over the pixels.
// ---------------------------------------------------------------------------
export function timeWarp(canvas, p = {}) {
  const D = dims(canvas, p, 4); if (!D) return;
  const { ctx, w, h, a, t } = D;
  const rng = rngFrom((p.seed || "time") + "|displace");
  const N = 10, LA = lat2(rng, N), LB = lat2(rng, N);
  const amp = a * Math.min(w, h) * 0.16;
  const step = 4, gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2;
  const DX = new Float32Array(gw * gh), DY = new Float32Array(gw * gh), MG = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const u = (i * step) / w, v = (j * step) / h, k = j * gw + i;
    let n = s2(LA, N, u * 2.4 + t * 0.05, v * 2.4 - t * 0.03) - 0.5;
    n += (s2(LA, N, u * 5.3 + 3.1, v * 5.3 + 7.7) - 0.5) * 0.42;
    const dir = (s2(LB, N, u * 1.6, v * 1.6) - 0.5) * 3.2;      // where "later" points
    const m = n * 2;
    DX[k] = amp * m * (0.72 + 0.28 * Math.cos(dir));
    DY[k] = amp * m * 0.38 * Math.sin(dir);
    MG[k] = Math.abs(m) > 1 ? 1 : Math.abs(m);
  }
  const tmp = copyOf(canvas, w, h);
  const src = tmp.getContext("2d").getImageData(0, 0, w, h).data;
  const out = ctx.createImageData(w, h), o = out.data;
  const px = (x, y, c) => {
    const xi = x < 0 ? 0 : x >= w ? w - 1 : x | 0, yi = y < 0 ? 0 : y >= h ? h - 1 : y | 0;
    return src[(yi * w + xi) * 4 + c];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gi = x / step, gj = y / step, i0 = gi | 0, j0 = gj | 0;
    const fx = gi - i0, fy = gj - j0, k = j0 * gw + i0;
    const dx = DX[k] + (DX[k + 1] - DX[k]) * fx + (DX[k + gw] - DX[k]) * fy;
    const dy = DY[k] + (DY[k + 1] - DY[k]) * fx + (DY[k + gw] - DY[k]) * fy;
    const mg = MG[k] + (MG[k + 1] - MG[k]) * fx + (MG[k + gw] - MG[k]) * fy;
    const fade = 1 - 0.24 * a * mg;                            // the further back, the weaker
    const di = (y * w + x) * 4;
    o[di] = px(x + dx * 1.14, y + dy * 1.14, 0) * fade;
    o[di + 1] = px(x + dx, y + dy, 1) * fade;
    o[di + 2] = px(x + dx * 0.86, y + dy * 0.86, 2) * fade;
    o[di + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

export const OPS2 = { timeWarp, rollingShutter, interlace, vhsTracking, dropout, frameEcho };

// Array order is the apply order once merged into OP_META: displace time first,
// then the scan faults, then the signal faults, and the ghost last so it echoes
// whatever the rest of the rack made.
export const OP_META2 = [
  { op: "timeWarp", label: "Time warp", cat: "glitch" },
  { op: "rollingShutter", label: "Rolling shutter", cat: "glitch" },
  { op: "interlace", label: "Interlace", cat: "glitch" },
  { op: "vhsTracking", label: "VHS tracking", cat: "glitch" },
  { op: "dropout", label: "Dropout", cat: "glitch" },
  { op: "frameEcho", label: "Frame echo", cat: "glitch" },
];
