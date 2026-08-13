/* glitch-ops-wave2.js — OPTICAL AND LENS.

   Six ops that behave like glass and a sensor rather than like a filter. Same
   contract as glitch-ops.js: fn(canvas, p) mutates the canvas in place, every
   random number comes from the seeded PRNG, one `amount` in [0,1] takes each op
   from a whisper to a scream. Zero dependencies, pure canvas 2D.

   The physics they follow:
     barrel     Brown-Conrady radial mapping, r_src = r_dst * (1 + k1*rn^2 + k2*rn^4)
     aberrate   lateral chromatic aberration: per-channel magnification, so the
                fringe grows with r^2 and is exactly zero at the optical centre
     bokeh      out-of-focus highlights become aperture-shaped discs with a
                brighter rim, not a flat blur
     halation   film base reflects light back through the emulsion, so bright
                areas bleed a warm halo with a near and a far component
     anamorph   a cylindrical element squeezes one axis: blur in squeezed space,
                unsqueeze, and the highlight streaks horizontally
     starburst  a polygonal iris diffracts clipped light into N spikes (even
                blade counts give N spikes, odd blade counts give 2N), all of
                them parallel across the frame because the iris does not rotate
*/

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFrom(seed) {
  if (typeof seed === "function") return seed;
  let h = 2166136261; const s = String(seed == null ? 1 : seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
}

const scratch = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const luma = (d, i) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const TAU = 6.2831853;

// Every op starts here: no canvas, no pixels, no work.
function dims(canvas, a) {
  if (!canvas) return null;
  const w = canvas.width | 0, h = canvas.height | 0;
  if (w < 2 || h < 2 || a <= 0.002) return null;
  return { w, h, ctx: canvas.getContext("2d") };
}

function blurTo(dst, src, px, sw, sh) {
  const x = dst.getContext("2d");
  if (px > 0.05) x.filter = "blur(" + px.toFixed(2) + "px)";
  x.imageSmoothingEnabled = true;
  try { x.imageSmoothingQuality = "high"; } catch (_) {}
  x.drawImage(src, 0, 0, sw, sh);
  x.filter = "none";
  return dst;
}

// Pull only the energy above a threshold into a small canvas, tinted. Below the
// knee the buffer is black, and black adds nothing under "lighter", so the
// glows built from it touch nothing but the highlights.
function highlights(canvas, div, thr, tint) {
  const w = canvas.width, h = canvas.height;
  const sw = Math.max(1, Math.round(w / div)), sh = Math.max(1, Math.round(h / div));
  const c = scratch(sw, sh), x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.drawImage(canvas, 0, 0, sw, sh);
  const im = x.getImageData(0, 0, sw, sh), d = im.data;
  const t = Math.min(0.97, Math.max(0, thr)), inv = 1 / (1 - t);
  for (let i = 0; i < d.length; i += 4) {
    const e = (luma(d, i) - t) * inv;
    if (e <= 0) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255; continue; }
    const g = e * e;                                  // soft knee, no hard rim
    d[i] = Math.min(255, d[i] * g * tint[0]);
    d[i + 1] = Math.min(255, d[i + 1] * g * tint[1]);
    d[i + 2] = Math.min(255, d[i + 2] * g * tint[2]);
    d[i + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return c;
}

// Brightest pixel of each coarse cell, above a threshold, capped. One sparse
// sweep of the frame, so a flat white picture costs the same as a dark one.
function brightPoints(src, w, h, step, thr, cap) {
  const out = [];
  for (let cy = 0; cy < h; cy += step) for (let cx = 0; cx < w; cx += step) {
    let bl = -1, bx = -1, by = -1, bi = 0;
    const ey = Math.min(h, cy + step), ex = Math.min(w, cx + step);
    for (let y = cy; y < ey; y += 2) for (let x = cx; x < ex; x += 2) {
      const i = (y * w + x) * 4, l = luma(src, i);
      if (l > bl) { bl = l; bx = x; by = y; bi = i; }
    }
    if (bx >= 0 && bl > thr) out.push({ x: bx, y: by, l: bl, i: bi });
  }
  if (out.length > cap) { out.sort((p, q) => q.l - p.l); out.length = cap; }
  return out;
}

// Cell pitch for the sparse sweeps: never finer than the effect wants, and
// never more than maxCells cells, so a 4K frame at a small amount costs the
// same sweep as a small one.
function gridStep(w, h, pref, maxCells) {
  const byArea = Math.ceil(Math.sqrt((w * h) / maxCells));
  return Math.max(3, pref | 0, byArea);
}

function polyPath(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  if (n < 3) { ctx.arc(x, y, r, 0, TAU); return; }
  for (let i = 0; i < n; i++) {
    const ang = rot + i * TAU / n, px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// barrel — radial geometric distortion, barrel or pincushion.
// Destination pixels map back to source radius r*(1 + k1*rn^2 + k2*rn^4) with rn
// normalised on the half-diagonal, so the centre never moves and the bend grows
// with the square of the radius the way a real element does. Pincushion is
// renormalised at the corner so no dest pixel has to read outside the frame.
// ---------------------------------------------------------------------------
function barrel(canvas, p = {}) {
  const D = dims(canvas, clamp01(p.amount ?? 0.5)); if (!D) return;
  const { w, h, ctx } = D, a = clamp01(p.amount ?? 0.5), rng = rngFrom(p.seed);
  const pin = p.mode === "pincushion";
  const k1 = p.k != null ? p.k : (pin ? a * 0.42 : -a * 0.42);
  const k2 = p.k2 != null ? p.k2 : k1 * 0.22;
  // no lens is centred perfectly; a seeded sub-percent decentring, deterministic
  const cx = w / 2 + (rng() - 0.5) * w * 0.02 * a, cy = h / 2 + (rng() - 0.5) * h * 0.02 * a;
  const rmax = Math.sqrt(cx * cx + cy * cy) || 1;
  const edge = 1 + k1 + k2, norm = edge > 1 ? 1 / edge : 1;   // keep the reads in frame
  const s = ctx.getImageData(0, 0, w, h).data, out = ctx.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy), rn = r / rmax;
    const r2 = rn * rn, g = (1 + k1 * r2 + k2 * r2 * r2) * norm;
    let fx = cx + dx * g, fy = cy + dy * g;
    fx = fx < 0 ? 0 : fx > w - 1 ? w - 1 : fx; fy = fy < 0 ? 0 : fy > h - 1 ? h - 1 : fy;
    // bilinear: geometry aliases badly on a nearest read
    const x0 = fx | 0, y0 = fy | 0, x1 = x0 + 1 < w ? x0 + 1 : x0, y1 = y0 + 1 < h ? y0 + 1 : y0;
    const tx = fx - x0, ty = fy - y0;
    const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
    const di = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) {
      const t0 = s[i00 + c] + (s[i10 + c] - s[i00 + c]) * tx;
      const t1 = s[i01 + c] + (s[i11 + c] - s[i01 + c]) * tx;
      o[di + c] = t0 + (t1 - t0) * ty;
    }
    o[di + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// ---------------------------------------------------------------------------
// aberrate — lateral chromatic aberration.
// Each channel gets its own magnification, not a flat XY offset: red focuses
// long and lands outside, blue lands inside, green sits almost on the nominal
// image. Displacement works out to k*d*r^2/rmax, so the centre of the frame
// stays clean and the corners fringe hardest, which is what a fast lens does.
// Two taps per fringed channel smear the fringe instead of ghosting it.
// ---------------------------------------------------------------------------
function aberrate(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), D = dims(canvas, a); if (!D) return;
  const { w, h, ctx } = D;
  const k = a * 0.055 * (p.strength ?? 1);
  const dR = p.dispR ?? 1, dG = p.dispG ?? -0.08, dB = p.dispB ?? -1.15;
  const s = ctx.getImageData(0, 0, w, h).data, out = ctx.createImageData(w, h), o = out.data;
  const cx = w / 2, cy = h / 2, rmax = Math.sqrt(cx * cx + cy * cy) || 1;
  const px = (fx, fy, c) => {
    let xi = fx | 0, yi = fy | 0;
    xi = xi < 0 ? 0 : xi >= w ? w - 1 : xi; yi = yi < 0 ? 0 : yi >= h ? h - 1 : yi;
    return s[(yi * w + xi) * 4 + c];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy, rn = Math.sqrt(dx * dx + dy * dy) / rmax, di = (y * w + x) * 4;
    const r1 = 1 + k * dR * rn, r2 = 1 + k * dR * rn * 0.55;
    o[di] = 0.62 * px(cx + dx * r1, cy + dy * r1, 0) + 0.38 * px(cx + dx * r2, cy + dy * r2, 0);
    const g1 = 1 + k * dG * rn;
    o[di + 1] = px(cx + dx * g1, cy + dy * g1, 1);
    const b1 = 1 + k * dB * rn, b2 = 1 + k * dB * rn * 0.55;
    o[di + 2] = 0.62 * px(cx + dx * b1, cy + dy * b1, 2) + 0.38 * px(cx + dx * b2, cy + dy * b2, 2);
    o[di + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// ---------------------------------------------------------------------------
// bokeh — defocus where the highlights survive as discs.
// The base goes soft with a gaussian, then every out-of-focus highlight is
// redrawn as an aperture-shaped disc (hexagonal by default, circular for a
// round iris) with a brighter rim, because a defocused point spreads into the
// shape of the hole and mirror-box lenses ring the edge. Cell count is bounded
// by the grid and then capped, so a blown-out white frame costs the same.
// ---------------------------------------------------------------------------
function bokeh(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), D = dims(canvas, a); if (!D) return;
  const { w, h, ctx } = D, rng = rngFrom(p.seed), m = Math.min(w, h);
  const R = Math.max(1, a * m * 0.055);
  const blades = p.shape === "circle" ? 0 : Math.max(0, Math.round(p.blades ?? 6));
  const src = ctx.getImageData(0, 0, w, h).data;
  // soft base first: the picture stays readable, it just loses its edges
  const soft = scratch(w, h);
  blurTo(soft, canvas, R * 0.55, w, h);
  ctx.drawImage(soft, 0, 0);
  const thr = 0.60 - a * 0.14;
  const step = gridStep(w, h, Math.round(R * 0.85), 20000);
  const pts = brightPoints(src, w, h, step, thr, 1200);
  if (!pts.length) return;
  const inv = 1 / Math.max(0.06, 1 - thr);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  for (let n = 0; n < pts.length; n++) {
    const c = pts[n], e = clamp01((c.l - thr) * inv);
    const rr = R * (0.5 + 0.5 * e) * (0.82 + 0.36 * rng());
    if (rr < 0.7) continue;
    const rot = rng() * TAU, al = 0.08 + 0.42 * e * e;
    const r0 = src[c.i], g0 = src[c.i + 1], b0 = src[c.i + 2];
    ctx.fillStyle = "rgba(" + (r0 | 0) + "," + (g0 | 0) + "," + (b0 | 0) + "," + al.toFixed(3) + ")";
    polyPath(ctx, c.x, c.y, rr, blades, rot);
    ctx.fill();
    // the rim: a defocused disc is not flat, it is brightest at its edge
    ctx.strokeStyle = "rgba(" + Math.min(255, r0 * 1.15 | 0) + "," + Math.min(255, g0 * 1.15 | 0) + "," +
      Math.min(255, b0 * 1.15 | 0) + "," + (al * 0.85).toFixed(3) + ")";
    ctx.lineWidth = Math.max(0.6, rr * 0.16);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// halation — the warm bleed of film.
// Light that gets through the emulsion reflects off the base and comes back up,
// so a highlight sits in a red-orange halo. Two components: a tight bright one
// and a wide faint one, both built only from the energy above the knee, both
// added. Everything below the knee is untouched.
// ---------------------------------------------------------------------------
function halation(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), D = dims(canvas, a); if (!D) return;
  const { w, h, ctx } = D, m = Math.min(w, h);
  const thr = p.threshold ?? (0.68 - a * 0.24);
  const tint = p.tint || [1.0, 0.42, 0.20];             // film base reflects warm
  const div = 4;
  const hi = highlights(canvas, div, thr, tint);
  const sw = hi.width, sh = hi.height;
  const near = scratch(sw, sh), far = scratch(sw, sh);
  blurTo(near, hi, Math.max(0.6, (m * 0.014 * (0.45 + a)) / div), sw, sh);
  blurTo(far, hi, Math.max(1.2, (m * 0.055 * (0.35 + a)) / div), sw, sh);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = Math.min(1, 0.30 + a * 0.60);
  ctx.drawImage(near, 0, 0, w, h);
  ctx.globalAlpha = Math.min(1, 0.18 + a * 0.52);
  ctx.drawImage(far, 0, 0, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// anamorph — horizontal flare off a cylindrical element.
// Done the way the glass does it rather than by smearing sideways: squeeze the
// highlight energy on X, blur it isotropically in squeezed space, then unsqueeze.
// The blur comes back stretched by the squeeze ratio, so the streak is long and
// thin and only the highlights carry it. A second tighter pass gives the core.
// ---------------------------------------------------------------------------
function anamorph(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), D = dims(canvas, a); if (!D) return;
  const { w, h, ctx } = D;
  const thr = p.threshold ?? (0.70 - a * 0.22);
  const tint = p.tint || [0.38, 0.66, 1.0];             // the classic blue streak
  const div = 4;
  const hi = highlights(canvas, div, thr, tint);
  const sw = hi.width, sh = hi.height;
  const squeeze = Math.max(2, (p.squeeze ?? 6) + a * 16);
  const wide = Math.max(1, Math.round(sw / squeeze));
  const core = Math.max(1, Math.round(sw / Math.max(2, squeeze * 0.35)));
  const bw = scratch(wide, sh), bc = scratch(core, sh);
  blurTo(bw, hi, 1.4 + a * 2.2, wide, sh);
  blurTo(bc, hi, 0.8 + a * 1.0, core, sh);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = Math.min(1, 0.34 + a * 0.56);
  ctx.drawImage(bw, 0, 0, w, h);                        // unsqueeze: the streak
  ctx.globalAlpha = Math.min(1, 0.20 + a * 0.40);
  ctx.drawImage(bc, 0, 0, w, h);                        // the bright core line
  ctx.restore();
}

// ---------------------------------------------------------------------------
// starburst — diffraction spikes off the iris.
// Only clipped highlights spike, the way a stopped-down lens behaves. The blade
// count is seeded: an even iris gives N spikes, an odd one gives 2N. Every
// spike in the frame shares one angle because the aperture does not rotate from
// point to point, and each ray disperses warm at the base to cool at the tip.
// ---------------------------------------------------------------------------
function starburst(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), D = dims(canvas, a); if (!D) return;
  const { w, h, ctx } = D, rng = rngFrom(p.seed), m = Math.min(w, h);
  let blades = Math.round(p.blades ?? (5 + Math.floor(rng() * 6)));   // 5 to 10
  blades = Math.max(3, Math.min(16, blades));
  const spikes = Math.min(16, blades % 2 === 0 ? blades : blades * 2);
  const base = (p.angle ?? rng() * Math.PI) + (p.phase ?? 0) * 0.05;
  const thr = p.threshold ?? (0.90 - a * 0.30);
  const step = gridStep(w, h, Math.round(28 - a * 14), 12000);
  const src = ctx.getImageData(0, 0, w, h).data;
  // total rays stay near a fixed budget however many blades the iris has
  const cap = Math.max(24, Math.min(140, Math.round(1100 / spikes)));
  const pts = brightPoints(src, w, h, step, thr, cap);
  if (!pts.length) return;
  const inv = 1 / Math.max(0.06, 1 - thr), maxLen = m * (0.05 + a * 0.24);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "butt";
  for (let n = 0; n < pts.length; n++) {
    const c = pts[n], e = clamp01((c.l - thr) * inv);
    const len = maxLen * (0.35 + 0.65 * e);
    if (len < 3) continue;
    const A = (0.16 + 0.5 * e) * (0.35 + 0.65 * a);
    for (let k = 0; k < spikes; k++) {
      const ang = base + k * TAU / spikes;
      const L = len * (0.72 + 0.5 * rng());
      const ex = c.x + Math.cos(ang) * L, ey = c.y + Math.sin(ang) * L;
      const g = ctx.createLinearGradient(c.x, c.y, ex, ey);
      g.addColorStop(0, "rgba(255,248,236," + A.toFixed(3) + ")");
      g.addColorStop(0.45, "rgba(255,214,168," + (A * 0.42).toFixed(3) + ")");
      g.addColorStop(0.85, "rgba(150,190,255," + (A * 0.12).toFixed(3) + ")");
      g.addColorStop(1, "rgba(150,190,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(0.7, len * 0.022);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
  }
  ctx.restore();
}

export const OPS2 = { barrel, aberrate, bokeh, halation, anamorph, starburst };

// Pipeline order: geometry, then the optics that read it, then the light that
// sits on top. Merge onto OP_META and the rack groups these into its shelves.
export const OP_META2 = [
  { op: "barrel", label: "Barrel", cat: "feel", desc: "lens distortion, straight lines bowing out from the centre" },
  { op: "aberrate", label: "Aberration", cat: "feel", desc: "chromatic aberration scaling the channels radially, worst at the corners" },
  { op: "bokeh", label: "Bokeh", cat: "feel", desc: "defocus where highlights open into aperture-shaped discs" },
  { op: "halation", label: "Halation", cat: "tone", desc: "the warm glow film base bleeds around a bright area" },
  { op: "anamorph", label: "Anamorphic", cat: "feel", desc: "a long horizontal streak off the clipped highlights" },
  { op: "starburst", label: "Starburst", cat: "feel", desc: "iris diffraction spikes at a seeded blade count" },
];
