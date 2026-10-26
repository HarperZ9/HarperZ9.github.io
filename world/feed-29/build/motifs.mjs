// motifs.mjs: the six motifs of the gradient-field poster generator. Each is (R, ctx, o) and draws into the linear
// raster R. ctx carries w, h, r (seeded), lut (ramp table), unit (px per 1/1024 of the short side), span, t (loop
// phase 0..1, every motif returns to its start at t = 1). o holds motif options; every option has a seeded default.
import { clamp, cover, smooth } from './lib/field.mjs';
import { lutAt, filmColor, saturate, hexLin, mixLin } from './lib/color.mjs';
import { drawPrims } from './gradfield.mjs';

const TAU = Math.PI * 2;
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? clamp(((x - ax) * dx + (y - ay) * dy) / L) : 0;
  return [Math.hypot(x - ax - t * dx, y - ay - t * dy), t];
}
const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// 1. Capsules: pill columns (or wave-tiled pill rows) each walking a stretch of the ramp along its length.
export function capsules(R, c, o) {
  const { w, h, r, lut, span, t } = c, m = 0.09 * Math.min(w, h), orient = o.orient ?? (r() < 0.6 ? 'v' : 'h');
  const cols = o.cols ?? 4 + Math.floor(r() * 5), rows = o.rows ?? (orient === 'v' ? 1 + Math.floor(r() * 2) : 5 + Math.floor(r() * 4));
  const wave = o.wave ?? (orient === 'h' ? 0.5 : 0), W = w - 2 * m, H = h - 2 * m, cw = W / cols, rh = H / rows, prims = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const L = 0.55 + 0.4 * r(), jit = r(), phase0 = ((i + 0.5 * j) % cols) / cols * (1 - span), ph = clamp(phase0 + 0.5 * (1 - span) * Math.sin(TAU * (t + i / cols)) * 0.5, 0, 1 - span);
    let ax, ay, bx, by, rad;
    if (orient === 'v') { rad = cw * 0.3; const top = m + j * rh + rh * (1 - L) * jit, bot = top + rh * L * 0.94; ax = bx = m + (i + 0.5) * cw; ay = top + rad; by = bot - rad; }
    else { rad = rh * 0.32; const off = wave * cw * 0.5 * Math.sin(TAU * (j / rows + t)); ay = by = m + (j + 0.5) * rh; ax = m + i * cw + cw * 0.08 + rad + off; bx = ax + cw * 0.84 - 2 * rad; }
    const len = Math.hypot(bx - ax, by - ay) + 2 * rad, out = [0, 0, 0];
    prims.push({
      bbox: [Math.min(ax, bx) - rad, Math.min(ay, by) - rad, Math.max(ax, bx) + rad, Math.max(ay, by) + rad],
      d: (x, y) => segDist(x, y, ax, ay, bx, by)[0] - rad,
      shadow: { dx: 0.12 * rad, dy: 0.32 * rad, soft: rad * 0.9, alpha: 0.26 },
      fill: (x, y, d, o3) => {
        const along = orient === "v" ? (y - ay + rad) / len : (x - ax + rad) / len;
        lutAt(lut, ph + span * clamp(along), out);
        const across = orient === 'v' ? (x - ax) / rad : (y - ay) / rad, shade = 0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - across * across)) + 0.1 * Math.exp(-(((across + 0.45) / 0.14) ** 2));
        o3[0] = out[0] * shade; o3[1] = out[1] * shade; o3[2] = out[2] * shade; return o3;
      },
    });
  }
  drawPrims(R, prims);
}

// Film colour table over (thickness, incidence cosine), chroma lifted, built once: 72 x 24 entries.
let FILM = null;
function filmTable() {
  if (FILM) return FILM;
  const D = 72, C = 24, T = new Float32Array(D * C * 3);
  for (let i = 0; i < D; i++) for (let j = 0; j < C; j++) { const col = saturate(filmColor(60 + i * 16, { n1: 1.36, n2: 1.52, cos0: 0.12 + 0.88 * j / (C - 1) }), 3.1, 0.7 + 0.1 * j / (C - 1)); T.set(col, 3 * (i * C + j)); }
  return (FILM = { D, C, T });
}
export function filmAt(d, cos, out) {
  const { D, C, T } = filmTable(), i = clamp(Math.round((d - 60) / 16), 0, D - 1), j = clamp(Math.round((cos - 0.12) / 0.88 * (C - 1)), 0, C - 1), k = 3 * (i * C + j);
  out[0] = T[k]; out[1] = T[k + 1]; out[2] = T[k + 2]; return out;
}

// 2. Spheres: a grid of film-coated spheres. Colour is thin-film interference at the view angle, thicker toward the
// bottom as a draining bubble is; each reflects a two-tone world, so a horizon line crosses every sphere; an AM
// halftone (QUALITY-SPEC R7 pitch, 8 to 10 px at 1x) prints the shadow side.
export function spheres(R, c, o) {
  const { w, h, r, unit, t } = c, n = o.n ?? (r() < 0.5 ? 3 : 5), S = Math.min(w, h) * 0.86, cell = S / n, x0 = (w - S) / 2, y0 = (h - S) / 2;
  const rad = cell * 0.4, pitch = (o.pitch ?? 9) * unit, ht = o.halftone ?? 0.55, ang = (o.screenDeg ?? 15) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  const sky = mixLin(hexLin(c.ground), [1, 1, 1], 0.5), earth = mixLin(hexLin(c.ground), [0.02, 0.018, 0.03], 0.82), Ld = [-0.48, -0.62, 0.62], prims = [], f = [0, 0, 0];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * cell, cy = y0 + (j + 0.5) * cell, dBase = 180 + 520 * r() + 40 * Math.sin(TAU * t), tilt = (r() - 0.5) * 0.25;
    prims.push({
      bbox: [cx - rad, cy - rad, cx + rad, cy + rad], d: (x, y) => Math.hypot(x - cx, y - cy) - rad,
      shadow: { dx: 0, dy: rad * 0.16, soft: rad * 0.45, alpha: 0.3 },
      fill: (x, y, _d, out) => {
        const u = clamp((x - cx) / rad, -1, 1), v = clamp((y - cy) / rad, -1, 1), nz = Math.sqrt(Math.max(0, 1 - u * u - v * v));
        filmAt(dBase + 420 * (0.5 + 0.5 * v), Math.max(0.12, nz), f);
        const diff = Math.max(0, u * Ld[0] + v * Ld[1] + nz * Ld[2]), up = -2 * nz * (v + tilt * u), fres = 0.04 + 0.96 * (1 - nz) ** 5;
        const env = up > 0 ? sky : earth, line = 1 - 0.8 * Math.exp(-((up / (0.012 + 0.02 * (1 - nz))) ** 2));
        for (let k = 0; k < 3; k++) out[k] = (f[k] * (0.42 + 0.75 * diff) * (1 - 0.45 * fres) + env[k] * 0.45 * fres) * line;
        // halftone: rotated cell grid, dot area proportional to darkness
        const gx = (x * ca + y * sa) / pitch, gy = (-x * sa + y * ca) / pitch, dx = (gx - Math.floor(gx) - 0.5) * pitch, dy = (gy - Math.floor(gy) - 0.5) * pitch;
        const dark = clamp(1 - Math.sqrt(luma(out)) * 1.25), dot = cover(Math.hypot(dx, dy) - pitch * 0.56 * Math.sqrt(dark), 0.3) * ht * 0.6;
        for (let k = 0; k < 3; k++) out[k] *= 1 - dot;
        return out;
      },
    });
  }
  drawPrims(R, prims);
}

// 3. Wedges: discs on a regular polygon, each with a sector cut toward the centre whose half-angle is half the
// polygon's interior angle, so the cut edges line up into an illusory polygon (Kanizsa 1955). reveal > 0 draws that
// polygon as a hairline: the exhibit shows its trick. Conic colour around each disc.
export function wedges(R, c, o) {
  const { w, h, r, lut, span, t, unit } = c, n = o.n ?? 5, M = Math.min(w, h), Rp = (o.radius ?? 0.27) * M, rd = (o.disc ?? 0.13) * M;
  const alpha = (Math.PI - TAU / n) / 2, cx = w / 2, cy = h / 2 + 0.02 * M, rot = -Math.PI / 2 + 0.12 * Math.sin(TAU * t), prims = [], col = [0, 0, 0];
  const verts = Array.from({ length: n }, (_, i) => [cx + Rp * Math.cos(rot + TAU * i / n), cy + Rp * Math.sin(rot + TAU * i / n)]);
  verts.forEach(([vx, vy], i) => {
    const ax = Math.atan2(cy - vy, cx - vx), ph = (i / n) * (1 - span) * 0.9 + r() * 0.05;
    const nP = [-Math.sin(ax + alpha), Math.cos(ax + alpha)], nM = [Math.sin(ax - alpha), -Math.cos(ax - alpha)];
    prims.push({
      bbox: [vx - rd, vy - rd, vx + rd, vy + rd],
      d: (x, y) => { const qx = x - vx, qy = y - vy, dd = Math.hypot(qx, qy) - rd, ds = Math.max(qx * nP[0] + qy * nP[1], qx * nM[0] + qy * nM[1]); return Math.max(dd, -ds); },
      shadow: { dx: rd * 0.06, dy: rd * 0.14, soft: rd * 0.35, alpha: 0.22 },
      fill: (x, y, _d, out) => {
        const th = Math.atan2(y - vy, x - vx) - ax, rr = Math.hypot(x - vx, y - vy) / rd;
        lutAt(lut, ph + span * (0.5 - 0.5 * Math.cos(th)), col);
        const s = 0.78 + 0.22 * (1 - rr * rr);
        out[0] = col[0] * s; out[1] = col[1] * s; out[2] = col[2] * s; return out;
      },
    });
  });
  drawPrims(R, prims);
  const reveal = o.reveal ?? 0;
  if (reveal > 0) for (let i = 0; i < n; i++) {
    const [ax, ay] = verts[i], [bx, by] = verts[(i + 1) % n], len = Math.hypot(bx - ax, by - ay), steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const x = ax + (bx - ax) * s / steps, y = ay + (by - ay) * s / steps; if (Math.hypot(x - ax, y - ay) < rd || Math.hypot(x - bx, y - by) < rd) continue;
      if (Math.floor(s / (6 * unit * 2)) % 2) continue; // dashed: the line is a reading aid, not a shape
      const k = 3 * (Math.round(y) * w + Math.round(x)); if (k < 0 || k >= R.px.length) continue;
      for (let q = 0; q < 3; q++) R.px[k + q] *= 1 - 0.55 * reveal;
    }
  }
  return verts;
}

// The summed field and its analytic gradient at (x, y): [F, dF/dx, dF/dy].
export function metaField(B, x, y) { let F = 0, gx = 0, gy = 0; for (const b of B) { const dx = x - b.x, dy = y - b.y, d2 = dx * dx + dy * dy + 1e-3, v = b.r * b.r / d2; F += v; gx -= 2 * v * dx / d2; gy -= 2 * v * dy / d2; } return [F, gx, gy]; }

// 4. Metaballs: a jittered grid of balls whose summed field F = sum r^2 / d^2 is cut at 1; neighbours closer than about
// two radii join with a neck. The edge is anti-aliased from F's analytic gradient; colour bands follow F and height.
export function metaballs(R, c, o) {
  const { w, h, r, lut, span, t } = c, g = o.grid ?? 3 + Math.floor(r() * 3), M = Math.min(w, h) * 0.84, cell = M / g, x0 = (w - M) / 2, y0 = (h - M) / 2, B = [];
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    const a = r() * TAU, orb = 0.07 * cell;
    B.push({ x: x0 + (i + 0.5 + (r() - 0.5) * 0.36) * cell + orb * Math.cos(a + TAU * t), y: y0 + (j + 0.5 + (r() - 0.5) * 0.36) * cell + orb * Math.sin(a + TAU * t), r: cell * (0.24 + 0.12 * r()) });
  }
  const { px } = R, col = [0, 0, 0], Fd = (x, y) => metaField(B, x, y);
  const sh = { dx: cell * 0.03, dy: cell * 0.07, soft: cell * 0.12 }, ph = r() * (1 - span);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = 3 * (y * w + x), [Fs, sgx, sgy] = Fd(x + 0.5 - sh.dx, y + 0.5 - sh.dy), ds = (1 - Fs) / (Math.hypot(sgx, sgy) + 1e-6), as = 0.26 * cover(ds, sh.soft);
    px[k] *= 1 - as; px[k + 1] *= 1 - as; px[k + 2] *= 1 - as;
    const [F, gx, gy] = Fd(x + 0.5, y + 0.5), gm = Math.hypot(gx, gy) + 1e-6, a = cover((1 - F) / gm, 0); if (a <= 0) continue;
    const height = clamp(Math.log(F) / Math.log(9)), lit = 0.78 + 0.22 * clamp((gx * 0.55 + gy * 0.7) / gm * (1 - height) + height);
    lutAt(lut, ph + span * clamp(0.8 * y / h + 0.2 * smooth(0, 1, height)), col);
    for (let q = 0; q < 3; q++) px[k + q] += (col[q] * lit - px[k + q]) * a;
  }
  return B;
}

// 5. Subdivide: a seeded recursive split of the sheet; each leaf is a linear gradient across one stretch of the ramp.
export function subdivide(R, c, o) {
  const { w, h, r, lut, span, unit, t } = c, m = 0.07 * Math.min(w, h), gap = (o.gap ?? 4) * unit, maxD = o.depth ?? 6, minS = 0.08 * Math.min(w, h), leaves = [];
  const split = (a, b, x1, y1, d) => {
    const W = x1 - a, H = y1 - b;
    if (d >= maxD || Math.max(W, H) < minS * 2 || (d >= 2 && r() < 0.12 * d)) { leaves.push([a, b, x1, y1, Math.floor(r() * 4), r()]); return; }
    const k = [0.382, 0.5, 0.618][Math.floor(r() * 3)];
    if (W > H * (0.8 + r() * 0.4)) { const s = a + W * k; split(a, b, s, y1, d + 1); split(s, b, x1, y1, d + 1); } else { const s = b + H * k; split(a, b, x1, s, d + 1); split(a, s, x1, y1, d + 1); }
  };
  split(m, m, w - m, h - m, 0);
  const col = [0, 0, 0], rc = 3 * unit;
  drawPrims(R, leaves.map(([a, b, x1, y1, dir, t0]) => {
    const A = a + gap / 2, Bq = b + gap / 2, X = x1 - gap / 2, Y = y1 - gap / 2, cxr = (A + X) / 2, cyr = (Bq + Y) / 2, hx = (X - A) / 2 - rc, hy = (Y - Bq) / 2 - rc, ph = clamp(t0 * (1 - span) + 0.08 * Math.sin(TAU * (t + t0)), 0, 1 - span);
    return {
      bbox: [A, Bq, X, Y], d: (x, y) => { const qx = Math.abs(x - cxr) - hx, qy = Math.abs(y - cyr) - hy; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc; },
      fill: (x, y, _d, out) => { const u = [(x - A) / (X - A), (y - Bq) / (Y - Bq), 1 - (x - A) / (X - A), 1 - (y - Bq) / (Y - Bq)][dir]; lutAt(lut, ph + span * u, col); out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; return out; },
    };
  }));
  return leaves;
}

// 6. Steps: two-source interference, I = cos^2(pi (r1 - r2) / lambda + pi t), under an envelope, sampled at column
// centres so it is stepped across and smooth down: a wave read through a coarse sensor.
export function steps(R, c, o) {
  const { w, h, lut, span, t } = c, cols = o.cols ?? 26, M = Math.min(w, h), sep = (o.sep ?? 0.09) * M, lam = (o.lambda ?? 0.11) * M, cx = w / 2, cy = h / 2, cw = w / cols, col = [0, 0, 0], { px } = R;
  for (let x = 0; x < w; x++) {
    const xc = (Math.floor(x / cw) + 0.5) * cw;
    for (let y = 0; y < h; y++) {
      const r1 = Math.hypot(xc - cx + sep, y - cy), r2 = Math.hypot(xc - cx - sep, y - cy), I = Math.cos(Math.PI * (r1 - r2) / lam + Math.PI * t) ** 2 * Math.exp(-((r1 + r2) / 2) / (0.42 * M)) * (0.55 + 0.45 * Math.cos(TAU * t + (r1 + r2) / (1.7 * lam)) ** 2);
      lutAt(lut, (1 - span) * 0.3 + span * clamp(I * 1.2), col); const k = 3 * (y * w + x), a = smooth(0.02, 0.9, I);
      for (let q = 0; q < 3; q++) px[k + q] += (col[q] * (0.3 + 0.9 * I) - px[k + q]) * a;
    }
  }
}

export const MOTIFS = { capsules, spheres, wedges, metaballs, subdivide, steps };
