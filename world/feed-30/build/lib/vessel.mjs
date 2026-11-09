// lib/vessel.mjs: stroke-to-object substitution (build c).
//
// A stroke keeps its path and becomes an object that follows it. The picked letters are lifted out of the ink and
// rebuilt from their own centre lines as glass tubes (a meniscus-level liquid, condenser coils, bubbles, Fresnel
// rims), laid rope (three strands on a helix) or pipe (a lit metal cylinder with flanges at the bends). The rest of
// the word stays ink, so the substitution reads as the one spot of colour.
//
// Material numbers come from the studio library (studio/lib/materials.mjs): glass, rope, liquid and
// art-deco (for the metal), and the glass optics module supplies Fresnel (Schlick) and the crown glass index.
//
// SPEC:
//   substitute(sk, { object glass|rope|pipe, pick: [glyph index] | 'auto', radius 0.6..2 x half width,
//                    fill 0..1 liquid level, coil 0..1 share of near-horizontal strokes, ink #hex, liquid #hex, seed })
//   -> { R: raster (transparent ground), ink: coverage of the unpicked letters, object: coverage of the objects }
// Deterministic for a skeleton and seed.
import { frameField, ribbonInto } from './geom.mjs';
import { canvas, paint, paintField, hexLin, rngFrom, clamp } from './raster.mjs';
import { byId } from '../../../studio/lib/materials.mjs';
import { schlick, GLASSES } from '../../../glass/lib/optics.js';
import { fbm } from '../../../techniques/lib/util.js';

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Which letter each inked pixel belongs to: the nearest centre line, or the letter's advance span. */
export function owners(sk) {
  const F = frameField(sk.w, sk.h, sk.strokes, (s) => s.width * 1.2, { nearest: true }), own = new Int32Array(sk.w * sk.h).fill(-1);
  for (let i = 0; i < own.length; i++) {
    if (sk.cov[i] <= 0) continue;
    if (F.id[i] >= 0) { own[i] = sk.strokes[F.id[i]].glyph; continue; }
    const x = i % sk.w; own[i] = sk.glyphs.findIndex((g) => x >= g.x0 && x < g.x1);
  }
  return own;
}

/** The default pick: the letter with the most centre-line length per word, one per word. */
export function autoPick(sk) {
  const len = sk.glyphs.map(() => 0), words = []; let cur = [];
  sk.strokes.forEach((s) => { for (let i = 1; i < s.pts.length; i++) len[s.glyph] += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]); });
  sk.glyphs.forEach((g, i) => { if (i && g.x0 - sk.glyphs[i - 1].x1 > sk.size * 0.15) { words.push(cur); cur = []; } cur.push(i); });
  words.push(cur);
  return words.map((wd) => wd.reduce((a, b) => (len[b] > len[a] ? b : a), wd[0]));
}

function liquidLevels(sk, picked, fill) {
  const lv = new Map();
  for (const g of picked) { let y0 = Infinity, y1 = -Infinity; for (const s of sk.strokes) if (s.glyph === g) for (const p of s.pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } lv.set(g, y0 + (1 - fill) * (y1 - y0)); }
  return lv;
}

function glassPixel(o, t, y, level, r) {
  const a = Math.abs(t), wall = Math.max(1.3 / r, 0.1);
  if (a > 1 - wall) return { c: o.ink, a: 1 };
  if (a > 1 - 2.6 * wall && a < 1 - 1.8 * wall) return { c: o.ink, a: 0.45 };
  const cos = Math.sqrt(Math.max(0, 1 - t * t)), R = schlick(cos, 1, GLASSES.crown.nd);
  const men = 0.35 * r * a ** 4; // the meniscus climbs the wall
  if (y > level - men) {
    const depth = 0.55 + 0.6 * cos, c = o.liquid.map((v) => v ** depth);
    if (Math.abs(y - (level - men)) < 1.1) return { c: mixc(c, [1, 1, 1], 0.6), a: 1 };
    return { c: mixc(c, [1, 1, 1], R * 0.8), a: 1 };
  }
  if (t < -0.38 && t > -0.6) return { c: [1, 1, 1], a: 0.85 };
  return { c: mixc(o.tint, [1, 1, 1], R), a: 0.18 + R * 1.4 };
}

function ropePixel(o, s, t, r) {
  if (Math.abs(t) > 0.94) return { c: o.ink, a: 1 };
  const phi = s / (2.6 * r) + t * 0.45, u3 = ((phi * 3) % 1 + 1) % 1, n = 2 * u3 - 1;
  const strand = Math.sqrt(Math.max(0, 1 - n * n)), body = Math.sqrt(Math.max(0, 1 - t * t)), groove = 1 - 0.7 * smooth(0.5, 0.97, Math.abs(n));
  const fibre = 0.8 + 0.4 * fbm(phi * 22, t * 4 + Math.floor(phi * 3) * 7, 5, 3), light = clamp((0.12 + 0.88 * strand * (0.45 + 0.55 * body) - 0.22 * t) * groove * fibre);
  return { c: mixc(o.ropeDark, o.ropeLight, light), a: 1 };
}

function pipePixel(o, t, flange) {
  const nx = t, nz = Math.sqrt(Math.max(0, 1 - t * t)), L = o.lamp, lam = Math.max(0, nx * L[0] + nz * L[2]);
  const hz = nz + L[2], hx = nx + L[0], hl = Math.hypot(hx, hz) || 1, spec = Math.max(0, (nz * hz + nx * hx) / hl) ** 60;
  const env = 0.25 * smooth(-0.55, -0.2, t) - 0.18 * smooth(0.15, 0.55, t);
  const base = flange ? 0.55 : 0.75, v = clamp(0.08 + base * lam * 0.75 + env + spec * 0.9);
  if (Math.abs(t) > 0.93) return { c: o.ink, a: 1 };
  return { c: mixc(o.metalDark, o.metalLight, v), a: 1 };
}

function coils(sk, strokes, r, share, rnd) {
  const out = [];
  for (const s of strokes) {
    const P = s.pts, dx = P[P.length - 1][0] - P[0][0], dy = P[P.length - 1][1] - P[0][1];
    if (Math.abs(dy) > Math.abs(dx) * 0.4 || Math.hypot(dx, dy) < r * 5 || rnd() > share) continue;
    const n = Math.ceil(Math.hypot(dx, dy) / 1.2), lam = r * 1.25, pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n, x = P[0][0] + dx * u, y = P[0][1] + dy * u, sx = Math.hypot(dx, dy) * u; const k = Math.sin((2 * Math.PI * sx) / lam) * r * 0.5; pts.push([x - (dy / Math.hypot(dx, dy)) * k, y + (dx / Math.hypot(dx, dy)) * k]); }
    out.push(pts);
  }
  return out;
}

function options(opt) {
  const glass = byId('glass'), rope = byId('rope'), deco = byId('art-deco'), liquid = byId('liquid');
  const az = ((deco?.core.lampAzDeg ?? 315) * Math.PI) / 180, el = ((deco?.core.lampDeg ?? 35) * Math.PI) / 180;
  return {
    object: 'glass', pick: 'auto', radius: 1.15, fill: 0.55, coil: 0.6, seed: 'vessel', ink: '#15130f', liquid: '#e6a03c', ...opt,
    tint: hexLin(glass?.palette.accent ?? '#a7c4c6'), ropeDark: hexLin(rope?.palette.ink ?? '#3b2a1a'), ropeLight: hexLin('#d9b98a'),
    metalDark: hexLin(deco?.palette.ground ?? '#101418'), metalLight: hexLin('#e8eef0'), lamp: [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)],
    bubbleRate: liquid?.core.particles ?? 0.2,
  };
}

/** Lift the picked letters out of the ink and rebuild their strokes as objects. */
export function substitute(sk, opt = {}) {
  const o = options(opt), rnd = rngFrom(o.seed), picked = new Set(o.pick === 'auto' ? autoPick(sk) : o.pick);
  const own = owners(sk), ink = new Float32Array(sk.w * sk.h);
  for (let i = 0; i < ink.length; i++) if (!picked.has(own[i])) ink[i] = sk.cov[i];
  const strokes = sk.strokes.filter((s) => picked.has(s.glyph)), r = sk.half * o.radius, levels = liquidLevels(sk, picked, o.fill);
  const F = frameField(sk.w, sk.h, strokes, r), col = new Float32Array(sk.w * sk.h * 3), cov = new Float32Array(sk.w * sk.h);
  const ink3 = hexLin(o.ink); o.ink = ink3; o.liquid = hexLin(o.liquid);
  for (let i = 0; i < cov.length; i++) {
    const k = F.id[i]; if (k < 0) continue;
    const y = (i / sk.w) | 0, t = F.t[i], s = F.s[i];
    const px = o.object === 'rope' ? ropePixel(o, s, t, r) : o.object === 'pipe' ? pipePixel(o, t, false) : glassPixel(o, t, y + 0.5, levels.get(strokes[k].glyph), r);
    col.set(px.c, i * 3); cov[i] = clamp(px.a) * clamp(r - Math.abs(t) * r + 0.5);
  }
  const R = canvas(sk.w, sk.h); paint(R, ink, ink3); paintField(R, cov, col);
  if (o.object === 'glass') details(R, sk, strokes, r, o, rnd, levels);
  if (o.object === 'pipe') flanges(R, sk, strokes, r, o);
  return { R, ink, object: cov, picked: [...picked] };
}

function details(R, sk, strokes, r, o, rnd, levels) {
  const line = new Float32Array(sk.w * sk.h);
  for (const pts of coils(sk, strokes, r, o.coil, rnd)) ribbonInto(line, sk.w, sk.h, pts, pts.map(() => Math.max(1, r * 0.12)));
  for (const s of strokes) for (let b = 0; b < 3 * o.bubbleRate * s.pts.length / 8; b++) {
    const p = s.pts[Math.floor(rnd() * s.pts.length)], rr = r * (0.08 + 0.14 * rnd()), x = p[0] + (rnd() - 0.5) * r, y = p[1] + (rnd() - 0.5) * r;
    if (y < levels.get(s.glyph) + rr * 2) continue;
    const ring = []; for (let a = 0; a <= 24; a++) ring.push([x + Math.cos((a / 24) * 2 * Math.PI) * rr, y + Math.sin((a / 24) * 2 * Math.PI) * rr]);
    ribbonInto(line, sk.w, sk.h, ring, ring.map(() => Math.max(1, r * 0.07)));
  }
  paint(R, line, o.ink, 0.9);
}

function flanges(R, sk, strokes, r, o) {
  const segs = [];
  for (const s of strokes) {
    const P = s.pts;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[i], c = P[Math.min(P.length - 1, i + 1)];
      const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]), turn = Math.abs(((t2 - t1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (!(i === 0 || i === P.length - 1 || turn > 0.45)) continue;
      const d = i === P.length - 1 ? [b[0] - a[0], b[1] - a[1]] : [c[0] - b[0], c[1] - b[1]], l = Math.hypot(...d) || 1, u = [d[0] / l, d[1] / l];
      segs.push({ pts: [[b[0] - u[0] * r * 0.28, b[1] - u[1] * r * 0.28], [b[0] + u[0] * r * 0.28, b[1] + u[1] * r * 0.28]], glyph: s.glyph });
    }
  }
  const F = frameField(sk.w, sk.h, segs, r * 1.22), col = new Float32Array(sk.w * sk.h * 3), cov = new Float32Array(sk.w * sk.h);
  for (let i = 0; i < cov.length; i++) { if (F.id[i] < 0) continue; const px = pipePixel(o, F.t[i], true); col.set(px.c, i * 3); cov[i] = clamp(r * 1.22 * (1 - Math.abs(F.t[i])) + 0.5); }
  paintField(R, cov, col);
}
