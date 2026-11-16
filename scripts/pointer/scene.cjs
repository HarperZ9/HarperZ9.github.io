// scene.cjs: the small solids the pointer is made of, seen from straight above, and their rasterisation.
//
// Every part is a solid of revolution whose axis lies in the screen (a frustum or a sphere), a torus lying in the
// screen, or a flat lit ring on the ground. With the axis in the screen and the view straight down, the silhouette
// is the profile itself and the height and normal of the visible point follow exactly from the profile. Parts form
// groups; a group draws its key line (a hard dark edge) around its whole outline, so the joins inside a stylus stay
// clean and a part lying over another is outlined. Samples are shaded in linear light and averaged per pixel.
'use strict';
const S = require('./spectral.cjs');
const { shade, rim, norm3 } = require('./surface.cjs');

const KEY_XYZ = [0.0036, 0.0038, 0.0042];   // the key line: a contact shadow, near black

function hitFrustum(q, p, inf) {
  const rx = p[0] - q.o[0], ry = p[1] - q.o[1];
  const s = rx * q.d[0] + ry * q.d[1], t = -rx * q.d[1] + ry * q.d[0];
  if (s < q.s0 || s > q.s1) return null;
  const slope = (q.r1 - q.r0) / (q.s1 - q.s0), R = q.r0 + slope * (s - q.s0), at = Math.abs(t);
  if (at > R + inf) return null;
  if (at >= R) return { band: true, d: at - R };
  const z = Math.sqrt(R * R - t * t), px = -q.d[1], py = q.d[0];
  let n = [(px * t) / R - slope * q.d[0], (py * t) / R - slope * q.d[1], z / R];
  let dark = false;
  const dc = q.decor || {};
  if (dc.knurl) { const k = dc.knurl.amp * Math.sin((2 * Math.PI * s) / dc.knurl.period); n = [n[0] + k * q.d[0], n[1] + k * q.d[1], n[2]]; }
  if (dc.slit || dc.hole) {
    const theta = Math.atan2(t, z);
    if (dc.slit) { const [sa, sb, w, phi] = dc.slit; if (s >= sa && s <= sb && Math.abs(theta - phi) * R < w / 2 && Math.cos(phi) > 0.05) dark = true; }
    if (dc.hole) { const [sh, rh, phi] = dc.hole; const a = (theta - phi) * R; if ((s - sh) ** 2 + a * a < rh * rh && Math.cos(phi) > 0.05) dark = true; }
  }
  return { z, n: norm3(n), edge: R - at, side: [px * Math.sign(t || 1), py * Math.sign(t || 1)], dark, d: at - R };
}

function hitSphere(q, p, inf) {
  const dx = p[0] - q.c[0], dy = p[1] - q.c[1], rr = Math.hypot(dx, dy);
  if (rr > q.r + inf) return null;
  if (rr >= q.r) return { band: true, d: rr - q.r };
  const z = Math.sqrt(q.r * q.r - rr * rr);
  return { z, n: [dx / q.r, dy / q.r, z / q.r], edge: q.r - rr, side: rr ? [dx / rr, dy / rr] : [0, -1], d: rr - q.r };
}

// a torus in the screen plane, optionally an arc from a0 to a1 (radians, screen angle) with round ends
function hitTorus(q, p, inf) {
  const dx = p[0] - q.c[0], dy = p[1] - q.c[1], rho = Math.hypot(dx, dy);
  if (q.arc) {
    let a = Math.atan2(dy, dx) - q.arc[0]; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (a > q.arc[1] - q.arc[0]) {
      const ends = [q.arc[0], q.arc[1]].map((e) => ({ c: [q.c[0] + q.R * Math.cos(e), q.c[1] + q.R * Math.sin(e)], r: q.r }));
      const h = ends.map((e) => hitSphere(e, p, inf)).filter(Boolean).sort((x, y) => (x.band ? 1 : 0) - (y.band ? 1 : 0));
      return h[0] || null;
    }
  }
  const u = rho - q.R, au = Math.abs(u);
  if (au > q.r + inf) return null;
  if (au >= q.r) return { band: true, d: au - q.r };
  const z = Math.sqrt(q.r * q.r - u * u), ux = rho ? dx / rho : 1, uy = rho ? dy / rho : 0;
  return { z, n: [(u / q.r) * ux, (u / q.r) * uy, z / q.r], edge: q.r - au, side: [ux * Math.sign(u || 1), uy * Math.sign(u || 1)], d: au - q.r };
}

// a flat lit ring (or disc, r0 = 0) on the ground: light, not a surface
function hitAnnulus(q, p, inf) {
  const rho = Math.hypot(p[0] - q.c[0], p[1] - q.c[1]);
  const d = Math.max(q.r0 - rho, rho - q.r1);
  if (d > inf) return null;
  if (d > 0) return { band: true, d };
  return { z: 0, emit: q.emit, edge: -d, d };
}

const HIT = { frustum: hitFrustum, sphere: hitSphere, torus: hitTorus, annulus: hitAnnulus };

// one sample: { xyz, a } (alpha 1 on the form or its key line; the shadow's alpha below it)
function sample(sc, p) {
  for (const g of sc.groups) {
    let best = null, band = false;
    for (const q of g.prims) {
      const h = HIT[q.kind](q, p, sc.kw);
      if (!h) continue;
      if (h.band) { band = true; continue; }
      if (!best || h.z > best.z) best = { ...h, q };
    }
    if (best) {
      if (best.emit) return { xyz: best.emit, a: 1 };
      const f = best.q.fin;
      let c = best.edge < sc.rw ? rim(f, best.side, sc.li) : shade(f, best.n, sc.li);
      if (best.dark) c = [c[0] * 0.05, c[1] * 0.05, c[2] * 0.05];
      return { xyz: c, a: 1 };
    }
    if (band && g.key !== false) return { xyz: KEY_XYZ, a: 1 };
  }
  if (sc.shadow) {
    const { group, off, soft, alpha } = sc.shadow, sp = [p[0] - off[0], p[1] - off[1]];
    let d = Infinity;
    for (const q of sc.groups[group].prims) { const h = HIT[q.kind](q, sp, soft + sc.kw); if (h) d = Math.min(d, h.d - sc.kw); }
    if (d < soft) return { xyz: [0, 0, 0], a: alpha * Math.min(1, Math.max(0, 0.5 - d / (2 * soft))) };
  }
  return null;
}

// a soft shoulder above 0.8, so a highlight keeps its shape instead of clipping flat
const shoulder = (v) => (v <= 0.8 ? Math.max(v, 0) : 0.8 + 0.2 * (1 - Math.exp(-(v - 0.8) / 0.2)));

// render at `scale` device pixels per unit; sub x sub samples per pixel. Returns { w, h, rgba }.
function render(sc, scale, sub = Math.max(3, Math.ceil(8 / scale))) {
  // at real size the key line is widened to a whole pixel, so the two-tone edge does not blur into one mid tone
  if (scale === 1 && sc.kw1) sc = { ...sc, kw: sc.kw1 };
  const w = sc.size * scale, h = w, rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < sub; j++) for (let i = 0; i < sub; i++) {
      const s = sample(sc, [(x + (i + 0.5) / sub) / scale, (y + (j + 0.5) / sub) / scale]);
      if (!s) continue;
      const lin = S.toLinear(s.xyz).map(shoulder);
      r += lin[0] * s.a; g += lin[1] * s.a; b += lin[2] * s.a; a += s.a;
    }
    const o = (y * w + x) * 4, n = sub * sub;
    if (a > 0) { rgba[o] = Math.round(S.encode(r / a) * 255); rgba[o + 1] = Math.round(S.encode(g / a) * 255); rgba[o + 2] = Math.round(S.encode(b / a) * 255); }
    rgba[o + 3] = Math.round((a / n) * 255);
  }
  return { w, h, rgba };
}

module.exports = { render, sample, KEY_XYZ };
