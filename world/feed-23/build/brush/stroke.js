// brush/stroke.js: a stroke is a path with dabs placed along it at a spacing tied to their own size.
// Input samples carry position (px), and optionally pressure p, tiltX, tiltY (degrees) and time t (seconds).
// One Stroker serves both uses: paintStroke (a whole path, smoothed, tapered at both ends) and liveStroke (a pen
// on a canvas, painted as samples arrive, with spacing, wet load and smudge finger carried across samples).
import { tip as getTip } from './tips.js';
import { grainFor } from './grain.js';
import { linear, rng, lerp, clamp } from './core.js';
import { dabParams, speedPressure } from './dynamics.js';

// Catmull-Rom, densified so consecutive points are at most `step` px apart. Scalars ride along.
export function smoothPath(pts, step = 1) {
  if (pts.length < 2) return pts.map((q) => ({ ...q }));
  const out = [], P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const q = { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
      for (const key of ['p', 'tiltX', 'tiltY', 't']) if (p1[key] !== undefined) q[key] = lerp(p1[key], p2[key] ?? p1[key], t);
      out.push(q);
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

const interp = (a, b, t) => {
  const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  for (const k of ['p', 'tiltX', 'tiltY']) if (a[k] !== undefined) q[k] = lerp(a[k], b[k] ?? a[k], t);
  return q;
};

class Stroker {
  // total: the path length when known (for the end taper); null for a live stroke
  constructor(surface, brush, { unit = surface.w, seed = 1, color, total = null } = {}) {
    Object.assign(this, { surface, brush, unit, total, R: rng(seed), next: 0, walked: 0, placed: 0, carry: null });
    this.tip = getTip(...(Array.isArray(brush.tip) ? brush.tip : [brush.tip]));
    this.paint = linear(color ?? brush.color ?? '#ffffff');
    this.grain = brush.grain ? grainFor(brush.grain.period * unit, brush.grain.kind, brush.grain.seed ?? 11) : null;
    this.finger = brush.smudge ? { n: 24, data: new Float32Array(24 * 24 * 4), ready: false } : null;
    this.shade = brush.shade ? { ...brush.shade, color: linear(brush.shade.color) } : null;
    this.taper = brush.taper ?? { start: 0, end: 0 };
  }

  // One dab at q. Returns the radius used (spacing depends on it).
  place(q, s) {
    const { brush, R, surface, taper } = this, d = dabParams(brush, s, this.unit, R);
    const L = this.total, startPx = taper.start * (L ?? brush.size * this.unit * 8);
    const ts = taper.start ? clamp(this.walked / startPx) : 1, te = taper.end && L ? clamp((L - this.walked) / (taper.end * L)) : 1;
    const radius = d.radius * (0.15 + 0.85 * Math.sqrt(Math.min(ts, te)));
    const sc = brush.jitter?.scatter ? brush.jitter.scatter * radius * 2 : 0;
    const x = q.x + (sc ? (R() * 2 - 1) * sc : 0), y = q.y + (sc ? (R() * 2 - 1) * sc : 0);
    const dab = { radius, aspect: d.aspect, angle: d.angle, alpha: d.flowAlpha * (brush.gain ?? 1), mode: brush.mode, grain: this.grain, grainDepth: brush.grain?.depth ?? 0 };
    if (this.finger) { surface.smear(this.tip, x, y, { ...dab, strength: brush.smudge.strength * d.flowAlpha, length: brush.smudge.length }, this.finger); return radius; }
    let col = this.paint;
    if (brush.wet) {
      // wet mixing: the bristles carry what they last touched; paint is thinned toward that load
      const under = surface.pick(x, y, radius * 0.6);
      if (!this.carry) this.carry = { rgb: under.rgb.slice(), a: under.a };
      const k = brush.wet.pickup ?? 0.3, c = this.carry;
      for (let i = 0; i < 3; i++) c.rgb[i] = lerp(c.rgb[i], under.rgb[i], k * under.a);
      const m = (brush.wet.mix ?? 0.4) * c.a;
      col = col.map((v, i) => lerp(v, c.rgb[i], m));
    }
    surface.dab(this.tip, x, y, { ...dab, color: col, shade: this.shade });
    return radius;
  }

  // Dabs along the segment A to B at their exact arc lengths.
  segment(A, B) {
    const seg = Math.hypot(B.x - A.x, B.y - A.y), l0 = this.walked, l1 = l0 + seg;
    const dt = B.t !== undefined && A.t !== undefined && B.t > A.t ? B.t - A.t : null, speed = dt ? seg / dt : 0;
    const dir = seg > 1e-9 ? Math.atan2(B.y - A.y, B.x - A.x) : 0;
    while (this.next <= l1 + 1e-9) {
      const t = seg > 1e-9 ? (this.next - l0) / seg : 0, q = interp(A, B, t);
      this.walked = this.next;
      const r = this.place(q, { p: q.p ?? (dt ? speedPressure(speed) : 1), tiltX: q.tiltX, tiltY: q.tiltY, speed, dir });
      this.placed++;
      this.next += Math.max(0.35, (this.brush.spacing ?? 0.15) * r * 2);
      if (seg <= 1e-9) break;
    }
    this.walked = l1;
  }
}

// Paint one whole stroke. brush: a preset (see presets.js). unit: px per canvas width (sizes and grain periods
// are fractions of it, so the same stroke list renders identically at any resolution). Returns the dab count.
export function paintStroke(surface, brush, samples, { unit = surface.w, seed = 1, color } = {}) {
  const path = smoothPath(samples, Math.max(0.5, brush.size * unit * 0.05));
  let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  const st = new Stroker(surface, brush, { unit, seed, color, total: L });
  if (path.length === 1) { st.segment(path[0], path[0]); return st.placed; }
  for (let i = 1; i < path.length; i++) st.segment(path[i - 1], path[i]);
  return st.placed;
}

// A live stroke for pointer input: add(sample) paints from the previous sample; returns dabs placed so far.
export function liveStroke(surface, brush, { unit = surface.w, seed = 1, color } = {}) {
  const st = new Stroker(surface, brush, { unit, seed, color });
  let prev = null;
  return {
    add(s) { if (!prev) st.segment(s, s); else st.segment(prev, s); prev = s; return st.placed; },
    get placed() { return st.placed; },
  };
}
