// The explainer kit's maths, in double precision: the reference the WGSL passes are held to
// (evidence/explainer-parity-bounds.json) and the version a C++ port copies. Every function
// here is pure and runs in Node.
//
//   orbAt(r, theta, spec)       radiance of the luminous orb at a polar point, linear RGB
//   apertureEdge(theta, spec)   the iris radius at an angle, for n straight blades
//   atmosphereAt(u, v, t, spec) a gradient ground with a horizon band and slow value noise
//   bezier(c, u)                a cubic curve point; c = [x0, y0, x1, y1, x2, y2, x3, y3]
//   pulseAt(u, phase, width)    a travelling pulse's brightness along a curve
//   lodKeep(id, keep)           whether point id is drawn when a fraction keep is kept
//   rampAt(stops, x)            a piecewise-linear colour ramp, stops [[x, [r, g, b]], ...]
// The integer hash is exact in both languages, so LOD selection matches point for point.

export const TAU = Math.PI * 2;

// The default orb: the canon's luminous aperture (DESIGN-INSPIRATION.md, "The mark"): a warm
// incandescent core, a fine radial line-work corona, and one prismatic ring where the light
// refracts (the art's single spectral mark). Linear light. pack.mjs and the WGSL use these values.
export const ORB = Object.freeze({
  core: [1.0, 0.78, 0.45], mid: [0.95, 0.42, 0.12], rim: [0.30, 0.10, 0.04],
  soft: 0.18, coreGain: 2.4, coreR: 0.24, haloGain: 0.10, haloR: 0.9, ring: 0, ringW: 0.012,
  iris: Object.freeze({ blades: 0, open: 1.2, rot: 0 }), gain: 1,
  spokes: 0, spokeGain: 0.35, spokeSharp: 24, prism: 0.025,
});
export const orbSpec = (spec = {}) => ({ ...ORB, ...spec, iris: { ...ORB.iris, ...(spec.iris || {}) } });

// lowbias32 (Wellons): a 32-bit integer hash. Math.imul keeps it in u32 arithmetic.
export function hash32(x) {
  x = x >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}
// A uniform number in [0, 1) from the top 24 bits: exact in f32 as well as f64.
export const hashUnit = (x) => (hash32(x) >>> 8) / 16777216;
export const lodKeep = (id, keep) => hashUnit(id) < keep;

// The fraction of a cloud to draw so it keeps about `density` points per covered pixel, and
// the gain that keeps an additive cloud's total light the same when points are dropped.
export function lodFraction(count, coveredPx, density = 1.5, minKeep = 1 / 64) {
  if (count <= 0) return { keep: 1, gain: 1 };
  const keep = Math.max(minKeep, Math.min(1, (density * coveredPx) / count));
  return { keep, gain: 1 / keep };
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

export function rampAt(stops, x) {
  if (x <= stops[0][0]) return stops[0][1].slice();
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [x0, c0] = stops[i - 1], [x1, c1] = stops[i];
      return mix3(c0, c1, (x - x0) / Math.max(1e-12, x1 - x0));
    }
  }
  return stops[stops.length - 1][1].slice();
}

// The iris: n straight blades rotated by `rot`; `open` is the radius at the blade corners (in orb
// radii), so a blade's middle sits at open * cos(pi / n). Returns the edge radius at angle theta.
// n < 3 gives a circle.
export function apertureEdge(theta, { blades = ORB.iris.blades, open = ORB.iris.open, rot = ORB.iris.rot } = {}) {
  if (blades < 3) return open;
  const seg = TAU / blades, x = theta - rot;
  const a = x - seg * Math.floor(x / seg);
  return (open * Math.cos(Math.PI / blades)) / Math.cos(a - Math.PI / blades);
}

// The luminous orb. r is distance from the centre in orb radii. Three parts, all in linear light:
// a hot core (gaussian), the body (a radial ramp core -> mid -> rim with a soft edge at r = 1), and a
// halo that falls off as 1 / (1 + (r / haloR)^2). The iris masks the body and core with a soft edge and
// draws a thin ring on the blade line.
export function orbAt(r, theta, spec) {
  const s = orbSpec(spec);
  const { core, mid, rim, soft, gain, coreGain, coreR, haloGain, haloR, ring, ringW } = s;
  const edge = apertureEdge(theta, s.iris);
  const m = 1 - smoothstep(edge - soft * 0.25, edge + soft * 0.25, r);
  const body = (1 - smoothstep(1 - soft, 1 + soft, r)) * m;
  const tint = r < 0.5 ? mix3(core, mid, r / 0.5) : mix3(mid, rim, clamp((r - 0.5) / 0.5, 0, 1));
  const hot = coreGain * Math.exp(-((r / coreR) ** 2)) * m;
  const halo = haloGain / (1 + (r / haloR) ** 2);
  // The corona: thin radial lines outside the iris, fading with distance.
  let spoke = 0;
  if (s.spokes > 0) {
    const c = 0.5 + 0.5 * cosTurns(s.spokes * theta / TAU);
    spoke = s.spokeGain * c ** s.spokeSharp * smoothstep(edge * 0.9, edge * 1.05, r) / (1 + ((r - edge) / 0.35) ** 2);
  }
  // The prismatic ring: the ring drawn at three radii, one per channel.
  return [0, 1, 2].map((i) => {
    const e = edge * (1 + s.prism * (i - 1)), d = (r - e) / ringW;
    return gain * (tint[i] * body + core[i] * hot + rim[i] * halo + core[i] * spoke + ring * Math.exp(-(d * d)));
  });
}

// cos of a whole number of turns plus a fraction: cos(2 pi x), reduced to one turn first. The
// WGSL twin reduces the same way and evaluates a polynomial, so large spoke counts stay exact.
export function cosTurns(x) {
  const f = x - Math.floor(x);
  return Math.cos(TAU * f);
}

// Smooth value noise on an integer lattice, from hash32. Quintic fade.
export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  // Lattice hash in u32 arithmetic (Math.imul wraps like WGSL's u32 multiply).
  const h = (i, j) => hashUnit((Math.imul(i | 0, 73856093) ^ Math.imul(j | 0, 19349663) ^ seed) >>> 0);
  const q = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const ux = q(fx), uy = q(fy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// The atmosphere: a vertical ramp (stops in v, 0 at the top), a horizon band around v = band with
// width bandW and colour bandC, and two octaves of drifting noise that modulate brightness by
// +-grain. u, v in 0..1 across the frame, t in seconds.
export function atmosphereAt(u, v, t, s) {
  const base = rampAt(s.stops, v);
  const bw = s.bandW ?? 0.08, bandC = s.bandC ?? [0, 0, 0];
  const band = Math.exp(-(((v - (s.band ?? 0.8)) / bw) ** 2));
  const aspect = s.aspect ?? 16 / 9, drift = s.drift ?? 0.01, seed = s.seed ?? 7;
  const n1 = valueNoise(u * 3 * aspect + t * drift, v * 3, seed);
  const n2 = valueNoise(u * 7 * aspect - t * drift * 1.7, v * 7, seed + 1);
  const n = (n1 * 0.65 + n2 * 0.35) * 2 - 1;
  const k = 1 + (s.grain ?? 0.12) * n;
  return [0, 1, 2].map((i) => (base[i] + bandC[i] * band) * k);
}

export function bezier(c, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, d = 3 * v * u * u, e = u * u * u;
  return [a * c[0] + b * c[2] + d * c[4] + e * c[6], a * c[1] + b * c[3] + d * c[5] + e * c[7]];
}
// A pulse travelling along a curve: phase in 0..1 is where its centre is.
export const pulseAt = (u, phase, width = 0.06) => Math.exp(-(((u - phase) / width) ** 2));

// An arc from x0 to x1 that bows up by h (negative h bows down), as cubic control points.
export function arc(x0, y0, x1, y1, h) {
  const dx = (x1 - x0) / 3;
  return [x0, y0, x0 + dx * 0.4, y0 - h, x1 - dx * 0.4, y1 - h, x1, y1];
}
