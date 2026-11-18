// world-field.mjs: built by packages/world/bundle.mjs from the files named below, each with the sha256 of its source.
// Do not edit: change the sources and build again. SPDX-License-Identifier: FSL-1.1-MIT
// ---- packages/world/field.mjs (sha256 a4a3c93018962f75f44e5db23ed9d2b85839a42382b92deff2fb6adae0b0c66c)
const { PROPERTY_IDS, clamp01, smooth, disc, carry, union2, mix2, luneburgN2, n2Blend, micro, kernelTable, element, carryAt, strength, mixture, largestStep, continuity } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// field.mjs: one field, many properties. The kernel mirrors src/field_kernel.bld function for function (that file is
// the source of record; tests/field.test.mjs holds this file to its output). Nothing here imports anything, so the
// site can carry this file as it is.
//
// An element is anything in the world: a pane of glass, a body of water, a probe, a word. It carries properties at
// weights from 0 to 1, and it carries them over a soft region: a disc whose rim is a gradient, never a hard edge.
// A property is a capability, not a place: refraction, flow, measurement, shape, voice, territory, circuitry. Where
// two elements overlap, the property's strength there is the union of what each carries and its value is their
// mixture, so light that crosses from glass into moving water bends by both at once, at the weights they hold.

// The property names, in the order the page shows them. properties.mjs gives each its core, its record and its limits.
const PROPERTY_IDS = Object.freeze(['lens', 'flow', 'measure', 'shape', 'sound', 'map', 'circuit']);

// ---- the kernel (src/field_kernel.bld) ----
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function smooth(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
const disc = (dx, dy, radius, edge) => 1 - smooth(radius - edge, radius + edge, Math.sqrt(dx * dx + dy * dy));
const carry = (mask, weight) => clamp01(mask * weight);
const union2 = (a, b) => 1 - (1 - a) * (1 - b);
function mix2(ca, va, cb, vb) { const s = ca + cb; return s <= 1e-12 ? 0 : (ca * va + cb * vb) / s; }
const luneburgN2 = (r, R) => (r >= R ? 1 : 2 - (r * r) / (R * R));
const n2Blend = (strength, mixed) => 1 + strength * (mixed - 1);
function micro(x) { return x < 0 ? -Math.trunc(-x * 1e6 + 0.5) : Math.trunc(x * 1e6 + 0.5); }

// The kernel's own table, line for line as src/field_kernel.bld prints it.
function kernelTable() {
  const out = [];
  for (let i = 0; i <= 10; i++) {
    const x = i * 0.1;
    out.push(`smooth ${i} ${micro(smooth(0.2, 0.8, x))}`, `disc ${i} ${micro(disc(x, 0, 0.5, 0.1))}`, `carry ${i} ${micro(carry(disc(x, 0.3, 0.6, 0.15), 0.7))}`,
      `union ${i} ${micro(union2(x, 0.4))}`, `mix ${i} ${micro(mix2(x, 1.7, 0.5, 1.3))}`, `luneburg ${i} ${micro(luneburgN2(x, 0.8))}`, `n2 ${i} ${micro(n2Blend(x, luneburgN2(0.3, 0.8)))}`);
  }
  return out.join('\n') + '\n';
}

// ---- elements ----
// { id, name, x, y, radius, edge, carries: { lens: 0.8, ... }, traits }. Positions and sizes are in scene units.
// traits are what the element is made of, which a property reads (a lens profile, a material, a colour).
function element({ id, name = id, x, y, radius, edge = radius * 0.25, carries = {}, traits = {} }) {
  if (!id || ![x, y, radius].every(Number.isFinite) || radius <= 0) throw new Error(`field: element ${id} needs an id, a place and a radius`);
  if (!(edge > 0)) throw new Error(`field: element ${id} needs a rim wider than 0; a boundary is a gradient`);
  const c = {};
  for (const [p, w] of Object.entries(carries)) {
    if (!PROPERTY_IDS.includes(p)) throw new Error(`field: "${p}" is not a property; the properties are ${PROPERTY_IDS.join(', ')}`);
    if (!(w >= 0 && w <= 1)) throw new Error(`field: ${id} carries ${p} at ${w}; a weight is from 0 to 1`);
    c[p] = w;
  }
  for (const p of PROPERTY_IDS) if (!(p in c)) c[p] = 0;
  return { id, name, x, y, radius, edge, carries: c, traits: { ...traits } };
}
// What one element gives one property at a point.
const carryAt = (el, prop, px, py) => carry(disc(px - el.x, py - el.y, el.radius, el.edge), el.carries[prop]);
// The property's strength at a point: the union over every element.
function strength(elements, prop, px, py) {
  let s = 0;
  for (const el of elements) s = union2(s, carryAt(el, prop, px, py));
  return s;
}
// The property's value at a point: each element's own value there, mixed by what each carries. valueOf(el, px, py).
// Returns { strength, value, carried }: carried is the sum of what the elements carry there (0 where none does).
function mixture(elements, prop, px, py, valueOf) {
  let s = 0, acc = 0, v = 0;
  for (const el of elements) {
    const c = carryAt(el, prop, px, py);
    if (c <= 0) continue;
    s = union2(s, c); v = mix2(acc, v, c, valueOf(el, px, py)); acc += c;
  }
  return { strength: s, value: v, carried: acc };
}

// ---- continuity ----
// The largest change between neighbouring samples of f over weights 0 to 1, at n steps.
function largestStep(f, n) {
  let prev = f(0), worst = 0;
  for (let i = 1; i <= n; i++) { const y = f(i / n); worst = Math.max(worst, Math.abs(y - prev)); prev = y; }
  return worst;
}
// A continuous output's largest step shrinks when the sampling is made finer; a jump stays the same size however fine
// the sampling. So sample at n and 2n: continuous when the finer largest step is at most `shrink` of the coarser one.
// A smooth output's ratio tends to 0.5; a jump's stays at 1. 0.75 leaves room for an output that is steep near one
// end (a small carrier meeting a large one) and still fails every switch.
function continuity(f, { n = 100, shrink = 0.75, floor = 1e-9 } = {}) {
  const coarse = largestStep(f, n), fine = largestStep(f, 2 * n);
  return { coarse, fine, ratio: coarse > floor ? fine / coarse : 0, continuous: coarse <= floor || fine <= shrink * coarse };
}

return { PROPERTY_IDS, clamp01, smooth, disc, carry, union2, mix2, luneburgN2, n2Blend, micro, kernelTable, element, carryAt, strength, mixture, largestStep, continuity };
})();
// ---- packages/rooms/properties/model.js (sha256 12cdd8801156b8d08d009e92982107668a576f45d91a2c10a3535b931626a918)
const { propertyObject, instrument, plainLabel } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// A property as a physical object in calculation space. A property has a state space with a shape, operations on it, the
// physical elements that perform them, the instrument assembled from them and a fabrication route with its limits.
// The shape renders a real mathematical object in coordinates someone chose, and the record says so.
const POTENTIAL = "potential";
const MEASURED = "measured";

const need = (o, k, what) => {
  if (o[k] === undefined || o[k] === null || o[k] === "") throw new Error(`${what}: missing ${k}`);
};
function propertyObject(p) {
  for (const k of ["id", "name", "stateSpace", "operations", "fabrication"]) need(p, k, "property");
  for (const k of ["name", "shape", "coordinates"]) need(p.stateSpace, k, `state space of ${p.id}`);
  if (p.stateSpace.coordinates.chosen !== true) throw new Error(`${p.id}: coordinates must be marked as chosen`);
  for (const op of p.operations) for (const k of ["id", "name", "element"]) need(op, k, `operation of ${p.id}`);
  need(p.fabrication, "route", `fabrication of ${p.id}`);
  if (!Array.isArray(p.fabrication.limits) || !p.fabrication.limits.length)
    throw new Error(`${p.id}: a fabrication route must state its limits`);
  return Object.freeze(p);
}
/**
 * An instrument starts potential and carries the bench's verdict. Only a measurement of a physical part changes the state.
 * A passing verdict says the model accepts the design and leaves the state alone.
 */
function instrument({ property, elements, path, verdict, limits = [], unmodelled = [] }) {
  need(verdict, "check", "verdict");
  if (typeof verdict.pass !== "boolean") throw new Error("verdict: pass must be true or false");
  return { property, elements, path, verdict, limits, unmodelled, state: POTENTIAL, measurement: null };
}
function recordMeasurement(ins, m) {
  for (const k of ["part", "instrument", "reading", "by", "date"]) need(m, k, "measurement");
  return { ...ins, state: MEASURED, measurement: m };
}
/** The plain label, kept apart from anything drawn. */
const plainLabel = (ins) =>
  `${ins.state}. Bench verdict: ${ins.verdict.pass ? "pass" : "fail"} on ${ins.verdict.check}.`;

return { propertyObject, instrument, plainLabel };
})();
// ---- packages/rooms/core/sampler.js (sha256 30bcf42709fd50db81b08ea7b917887f6eb84cbc7c2c4c7c0c4be786c3cdbf18)
const { Pcg } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// The shaders' random number: st=st*747796405u+2891336453u; w=((st>>((st>>28u)+4u))^st)*277803737u;
// float((w>>22u)^w)/2^32. This is the same integer maths on the CPU, so a CPU reference can share a stream.
function pcgStep(state) {
  const st = (Math.imul(state, 747796405) + 2891336453) >>> 0;
  const w = Math.imul(((st >>> ((st >>> 28) + 4)) ^ st) >>> 0, 277803737) >>> 0;
  return { state: st, value: (((w >>> 22) ^ w) >>> 0) / 4294967296 };
}
class Pcg {
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }
  next() {
    const r = pcgStep(this.state);
    this.state = r.state;
    return r.value;
  }
}

return { Pcg };
})();
// ---- packages/rooms/core/trace.js (sha256 6a3c23fcdafa6c14ab9a2a55c60ef57f0fec07309fa9f086abe4ada38dde33cf)
const { rk4 } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// CPU reference for the known answers the shaders are held to. Double precision, no GPU, so CI can run it. It
// covers the shapes the checks use: the plate and the globe, plus index fields. It does not replace the shader.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const norm = (a) => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const reflect = (d, n) => add(d, n, -2 * dot(d, n));
/** Refract d through unit normal n (facing the ray), eta = n1/n2. Returns null at total internal reflection. */
function refract(d, n, eta) {
  const c = -dot(d, n),
    k = 1 - eta * eta * (1 - c * c);
  return k < 0 ? null : norm(add([eta * d[0], eta * d[1], eta * d[2]], n, eta * c - Math.sqrt(k)));
}
const plateSdf = (hT, rim = 1.2) => (p) => Math.max(Math.hypot(p[0], p[1]) - rim, Math.abs(p[2]) - hT);
const globeSdf = (R = 1) => (p) => Math.hypot(...p) - R;
const grad = (f, p, e = 1e-6) =>
  norm([
    f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]),
    f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]),
    f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e]),
  ]);

/** Walk a ray inside a body until it refracts out, counting total internal reflections. */
function traceInside(sdf, n, p0, d0, maxBounce = 200) {
  let p = p0,
    d = d0,
    bounces = 0;
  for (let i = 0; i < 200000; i++) {
    const v = sdf(p);
    if (v > -1e-9) {
      const N = grad(sdf, p);
      const out = refract(d, [-N[0], -N[1], -N[2]], n);
      if (out) return { exited: true, bounces, p, d: out };
      d = reflect(d, N);
      p = add(p, d, 1e-7);
      p = add(p, N, -2e-9);
      if (++bounces > maxBounce) break;
      continue;
    }
    p = add(p, d, Math.max(-v, 2e-9));
  }
  return { exited: false, bounces, p, d };
}
/** Largest angle from the normal that leaves a plate from its mid plane. Fan of 4096 rays, as on the page. */
function snellWindowDeg(n) {
  const sdf = plateSdf(0.6),
    A = (Math.PI / 2) * 0.7,
    w = 4096;
  let last = 0;
  for (let k = 0; k < w; k++) {
    const a = (k / w) * A;
    if (traceInside(sdf, n, [0, 0, 0], [Math.sin(a), 0, Math.cos(a)], 0).bounces === 0) last = a;
    else break;
  }
  return (last * 180) / Math.PI;
}
function plateRepeats(deg, c, n) {
  const hT = 0.08 + 0.52 * c,
    T = 2 * hT,
    th = (deg * Math.PI) / 180;
  const r = traceInside(plateSdf(hT), n, [0, 0, 0], [Math.sin(th), 0, Math.cos(th)], 500);
  return { measured: r.bounces, predicted: 1 + Math.floor((1.2 - hT * Math.tan(th)) / (T * Math.tan(th))) };
}
function enterGlobe(h, n) {
  const z = -Math.sqrt(1 - h * h),
    N = [h, 0, z];
  return { p: N, d: refract([0, 0, 1], N, 1 / n) };
}
/** Parallel rays into a unit globe: the highest ray that still hits a centred sphere of radius a. */
function centreSphereEdge(n, a, w = 2048) {
  let e = 0;
  for (let k = 0; k < w; k++) {
    const h = (k + 1) / w;
    if (h >= 1) break;
    const { p, d } = enterGlobe(h, n);
    const b = dot(p, d),
      miss = Math.sqrt(Math.max(dot(p, p) - b * b, 0));
    if (miss <= a) e = h;
  }
  return e;
}
/** Axis point at radius r in a unit globe: back-project the exiting rays; compare n/s + 1/s' = (n-1)/R. */
function apparentRadius(n, r) {
  let sum = 0,
    N = 0;
  for (let k = 8; k < 64; k++) {
    const a = (k / 64) * 0.02,
      d0 = [Math.sin(a), 0, -Math.cos(a)];
    const q = traceInside(globeSdf(1), n, [0, 0, -r], d0, 0);
    const ty = q.d[0] / q.d[2];
    if (Math.abs(ty) < 1e-5) continue;
    sum += q.p[2] - q.p[0] / ty;
    N++;
  }
  const s = 1 - r,
    sp = 1 / ((n - 1) / 1 - n / s);
  return { measured: N ? -(sum / N) : r, predicted: 1 + sp };
}

/** One RK4 step of the ray equation x'' = grad(n^2)/2 in the parameter where |x'| = n. */
function rk4(p, v, dt, n2) {
  const g = (q) => {
    const e = 1e-5;
    return [
      (n2([q[0] + e, q[1], q[2]]) - n2([q[0] - e, q[1], q[2]])) / (4 * e),
      (n2([q[0], q[1] + e, q[2]]) - n2([q[0], q[1] - e, q[2]])) / (4 * e),
      (n2([q[0], q[1], q[2] + e]) - n2([q[0], q[1], q[2] - e])) / (4 * e),
    ];
  };
  const a1 = g(p),
    v2 = add(v, a1, dt / 2),
    a2 = g(add(p, v, dt / 2)),
    v3 = add(v, a2, dt / 2),
    a3 = g(add(p, v2, dt / 2)),
    v4 = add(v, a3, dt),
    a4 = g(add(p, v3, dt));
  return {
    p: [0, 1, 2].map((i) => p[i] + (dt / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i])),
    v: [0, 1, 2].map((i) => v[i] + (dt / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i])),
  };
}
function luneburgExit(rays = 32, field = (p) => 2 - dot(p, p)) {
  let s = 0,
    mx = 0,
    N = 0;
  for (let k = 0; k < rays; k++) {
    const A = (k / rays) * 1.2,
      n0 = Math.sqrt(field([0, 0, -0.999]));
    let p = [0, 0, -0.999],
      v = [n0 * Math.sin(A), 0, n0 * Math.cos(A)];
    for (let i = 0; i < 20000 && Math.hypot(...p) < 1; i++) ({ p, v } = rk4(p, v, 5e-4, field));
    const N0 = norm(p);
    const out = refract(norm(v), [-N0[0], -N0[1], -N0[2]], Math.sqrt(field(p)));
    if (!out) continue;
    const an = Math.atan2(Math.hypot(out[0], out[1]), out[2]);
    s += an * an;
    mx = Math.max(mx, an);
    N++;
  }
  return { rmsDeg: (Math.sqrt(s / Math.max(N, 1)) * 180) / Math.PI, maxDeg: (mx * 180) / Math.PI, rays: N };
}
function fisheyeAntipode(a = 1) {
  const field = (p) => 4 / (1 + dot(p, p) / (a * a)) ** 2;
  const src = [0.5 * a, 0, 0],
    anti = [-2 * a, 0, 0];
  let spread = 0;
  for (const ang of [0.5, 1, 1.5, 2, 2.5]) {
    const n0 = Math.sqrt(field(src));
    let p = src,
      v = [n0 * Math.cos(ang), n0 * Math.sin(ang), 0],
      best = 1e9;
    // Equal steps of optical path: dt shrinks where n is large. Half the great circle has optical length pi.
    for (let o = 0; o < Math.PI * 1.02 * a; o += 2e-4) {
      ({ p, v } = rk4(p, v, 2e-4 / field(p), field));
      best = Math.min(best, Math.hypot(p[0] - anti[0], p[1] - anti[1], p[2]));
    }
    spread = Math.max(spread, best);
  }
  return { spread };
}
/** Eaton lens n^2 = 2R/r - 1, R = 1. A ray enters at impact b and leaves with direction reversed. */
function eatonTurn(b) {
  const field = (p) => {
    const r = Math.hypot(...p);
    return r < 1 ? Math.max(2 / r - 1, 1e-4) : 1;
  };
  let p = [b, 0, -1.2],
    v = [0, 0, 1];
  for (let i = 0; i < 2000000 && Math.hypot(...p) <= 1.3; i++) {
    const r = Math.hypot(...p);
    ({ p, v } = rk4(p, v, Math.max(2e-5, Math.min(2e-3, r * r * 0.002)), field));
  }
  const d = norm(v);
  return { turnDeg: (Math.atan2(Math.hypot(d[0], d[1]), d[2]) * 180) / Math.PI };
}
/** Weak gravity index n = 1 + 2 mu / r: deflection of a ray at impact b over a path from -L to +L. */
function gravityDeflection(mu, b, L) {
  const field = (p) => (1 + (2 * mu) / Math.max(Math.hypot(...p), 1e-3)) ** 2;
  let p = [b, 0, -L],
    v = [0, 0, Math.sqrt(field(p))];
  for (let i = 0; i < 400000 && p[2] < L; i++) ({ p, v } = rk4(p, v, 0.02 + 0.02 * Math.abs(p[2]), field));
  const pred = (4 * mu) / b;
  return { measured: Math.atan2(-v[0], v[2]), predicted: pred, finitePredicted: pred * (L / Math.hypot(L, b)) };
}

/** Isotropic scattering in a slab of optical density sigma and thickness L, entered at normal incidence. */
function slabTransport(sigma, L, rays, seed = 1) {
  const r = new Pcg(seed);
  let thru = 0,
    uns = 0;
  for (let k = 0; k < rays; k++) {
    let z = 0,
      mu = 1,
      scattered = false;
    for (let guard = 0; guard < 1e6; guard++) {
      const t = sigma > 0 ? -Math.log(1 - r.next()) / sigma : Infinity;
      z += t * mu;
      if (z >= L) {
        thru++;
        if (!scattered) uns++;
        break;
      }
      if (z <= 0) break;
      mu = 2 * r.next() - 1;
      scattered = true;
    }
  }
  return { transmitted: thru / rays, unscattered: uns / rays };
}
function diffusionSlope(sigma, Ls, rays, seed = 1) {
  const z = 0.71 / sigma;
  const xs = Ls.map((L) => Math.log(L + 2 * z));
  const ys = Ls.map((L, i) => Math.log(Math.max(slabTransport(sigma, L, rays, seed + i).transmitted, 1e-5)));
  const mx = xs.reduce((a, b) => a + b) / xs.length,
    my = ys.reduce((a, b) => a + b) / ys.length;
  let nu = 0,
    de = 0;
  xs.forEach((x, i) => {
    nu += (x - mx) * (ys[i] - my);
    de += (x - mx) ** 2;
  });
  return { slope: nu / de };
}
const malus = (deg) => 0.5 * Math.cos((deg * Math.PI) / 180) ** 2;
/** Two line gratings of pitch p crossed at deg: find the beat along y, as the page does on its rendered frame. */
function moireFromGratings(deg, p) {
  const a = ((deg / 2) * Math.PI) / 180,
    pred = p / (2 * Math.sin(a)),
    h = 2048,
    w = 256,
    Y = 12 * (p / (2 * Math.sin(((3 / 2) * Math.PI) / 180))),
    prof = new Float64Array(h);
  for (let j = 0; j < h; j++) {
    const y = (j / h) * Y;
    let s = 0;
    for (let i = 0; i < w; i++) {
      const x = (i / w) * 64 * p;
      const g = (u) => 0.5 + 0.5 * Math.cos((2 * Math.PI * u) / p);
      s += g(x * Math.cos(a) + y * Math.sin(a)) * g(x * Math.cos(a) - y * Math.sin(a));
    }
    prof[j] = s / w;
  }
  const mean = prof.reduce((u, v) => u + v) / h;
  const base = p / (2 * Math.sin(((3 / 2) * Math.PI) / 180));
  let best = 0,
    bp = 0;
  for (let P = base * 0.25; P < base * 1.6; P += base * 0.002) {
    let c = 0,
      s = 0;
    for (let j = 0; j < h; j++) {
      const t = (2 * Math.PI * (j / h) * Y) / P;
      c += (prof[j] - mean) * Math.cos(t);
      s += (prof[j] - mean) * Math.sin(t);
    }
    if (c * c + s * s > best) {
      best = c * c + s * s;
      bp = P;
    }
  }
  return { measured: bp, predicted: pred };
}
/** Spinning mirror surface z = -cv r^2: a parallel ray reflects and crosses the axis at the focus. */
function parabolaFocus(cv, h = 0.01) {
  const n = norm([2 * cv * h, 0, 1]),
    d = reflect([0, 0, 1], n);
  const z0 = -cv * h * h,
    t = -h / d[0];
  return Math.abs(z0 + t * d[2]);
}

return { rk4 };
})();
// ---- packages/rooms/core/units.js (sha256 66e32bbbf6925e717d153b98233304a3acce73a2cb4be110fc537b87dda83878)
const { unit } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// A unit is a scale to SI plus a dimension vector, the same model as packages/field/src/units.js. The field
// package is not on main yet; once it is, tests/units-field.test.mjs compares the two tables.
const BASE = ["m", "kg", "s", "A", "K", "mol", "cd", "bit"];
const d = (o = {}) => BASE.map((b) => o[b] || 0);
const TABLE = {
  1: [1, d()],
  rad: [1, d()],
  deg: [Math.PI / 180, d()],
  sr: [1, d()],
  m: [1, d({ m: 1 })],
  cm: [1e-2, d({ m: 1 })],
  mm: [1e-3, d({ m: 1 })],
  um: [1e-6, d({ m: 1 })],
  nm: [1e-9, d({ m: 1 })],
  s: [1, d({ s: 1 })],
  ms: [1e-3, d({ s: 1 })],
  ns: [1e-9, d({ s: 1 })],
  Hz: [1, d({ s: -1 })],
  kg: [1, d({ kg: 1 })],
  g: [1e-3, d({ kg: 1 })],
  A: [1, d({ A: 1 })],
  K: [1, d({ K: 1 })],
  N: [1, d({ kg: 1, m: 1, s: -2 })],
  Pa: [1, d({ kg: 1, m: -1, s: -2 })],
  J: [1, d({ kg: 1, m: 2, s: -2 })],
  W: [1, d({ kg: 1, m: 2, s: -3 })],
  C: [1, d({ A: 1, s: 1 })],
  V: [1, d({ kg: 1, m: 2, s: -3, A: -1 })],
  F: [1, d({ kg: -1, m: -2, s: 4, A: 2 })],
  H: [1, d({ kg: 1, m: 2, s: -2, A: -2 })],
  ohm: [1, d({ kg: 1, m: 2, s: -3, A: -2 })],
  S: [1, d({ kg: -1, m: -2, s: 3, A: 2 })],
  bit: [1, d({ bit: 1 })],
};
class UnitError extends Error {
  constructor(m) {
    super(m);
    this.name = "UnitError";
  }
}
function one(tok) {
  const m = /^([A-Za-z]+|1)(?:\^(-?\d+))?$/.exec(tok.trim());
  if (!m || !TABLE[m[1]]) throw new UnitError(`unknown unit '${tok}'`);
  const e = m[2] ? +m[2] : 1;
  return { scale: TABLE[m[1]][0] ** e, dim: TABLE[m[1]][1].map((x) => x * e) };
}
/** "V/um", "N/m", "kg/s^2", "m*K". Division binds to the next factor. */
function unit(s = "1") {
  let scale = 1,
    dim = d(),
    sign = 1;
  for (const p of String(s).split(/([*/])/)) {
    if (p === "*" || p === "/") {
      sign = p === "*" ? 1 : -1;
      continue;
    }
    const q = one(p);
    scale *= q.scale ** sign;
    dim = dim.map((x, i) => x + sign * q.dim[i]);
  }
  return { name: String(s), scale, dim };
}
const sameDim = (a, b) => unit(a).dim.every((x, i) => x === unit(b).dim[i]);
function convert(v, from, to) {
  if (!sameDim(from, to)) throw new UnitError(`cannot convert ${from} to ${to}`);
  return (v * unit(from).scale) / unit(to).scale;
}

return { unit };
})();
// ---- packages/rooms/core/provenance.js (sha256 6217563b29af3c7241bbec2e2cd58077f4447d7da37d0ed6db78a506cc4d6a29)
const { constant } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// Every physical constant is a frozen record: value, unit, source, and how it was checked. A record with no
// check names carries the flag. "verified" means a comparison that someone ran and wrote down, never a citation.

const FROM_MEMORY = "from memory, unverified";

function constant(value, unitName, { source, verified = false, note } = {}) {
  if (!source) throw new Error(`constant ${value} has no source`);
  if (verified && !(verified.against && verified.result))
    throw new Error(`constant ${value}: a check must name what it ran against and its result`);
  unit(unitName);
  return Object.freeze({
    value,
    unit: unitName,
    source,
    verified: verified ? Object.freeze(verified) : false,
    flag: verified ? null : FROM_MEMORY,
    ...(note ? { note } : {}),
  });
}

function auditConstants(table) {
  const rows = Object.entries(table);
  const unverified = rows.filter(([, q]) => q.flag).map(([k]) => k);
  return {
    total: rows.length,
    verified: rows.length - unverified.length,
    unverified: unverified.length,
    unverifiedNames: unverified,
  };
}

return { constant };
})();
// ---- packages/rooms/core/constants.js (sha256 94060f8b3c9762035f667710ab03e9a34a6dcbd96636c8f7b2c36d9f44fc9e96)
const { MATERIAL_RECORDS, CONSTANTS } = (() => {
const c = constant;
// SPDX-License-Identifier: FSL-1.1-MIT
// Physical constants the rooms use, each with unit and source. Those marked verified were compared on 2026-10-31
// against the reference named in the row; every other row carries the flag "from memory, unverified" until a check
// is run and written here. A citation alone does not clear the flag.

const CODATA = "CODATA 2022 table, NIST SRD 121 (packages/measured codata2022.json)";
const SCHOTT = "SCHOTT optical glass data sheets, 2025 overview";
const RII = "Interpolated at 587.6 nm in packages/materials (refractiveindex.info CC0 records)";
const checked = (against, result) => ({ against, result });

const PHYSICS = {
  standardGravity: c(9.80665, "m/s^2", {
    source: "CGPM 1901, defined value",
    verified: checked(CODATA, "equal, exact"),
  }),
  vacuumPermittivity: c(8.854e-12, "F/m", {
    source: "CODATA, rounded to 4 figures on the page",
    verified: checked(CODATA, "8.8541878188e-12 rounds to this; relative difference 2e-5"),
  }),
  illuminantAc2: c(1.435e7, "nm*K", {
    source: "CIE 15, illuminant A definition",
    verified: checked("CIE illuminant A 1 nm table (packages/measured cie_check.json)", "max relative error 4.77e-6, 380 to 780 nm"),
    note: "The CIE definition fixes this value. CODATA gives 1.438777e7 nm K, which must not be used for illuminant A.",
  }),
  illuminantAT: c(2848, "K", {
    source: "CIE 15, illuminant A definition",
    verified: checked("CIE illuminant A 1 nm table (packages/measured cie_check.json)", "as above"),
  }),
  cmfTable: c("core/data/cie.js CMF", "1", {
    source: "CIE 1931 2 degree observer, 10.25039/CIE.DS.xvudnb9b",
    verified: checked("CIE_xyz_1931_2deg.csv at 10 nm, 380 to 700 nm", "max absolute difference 1.6e-7"),
  }),
  d65Table: c("core/data/cie.js D65", "1", {
    source: "CIE D65, 10.25039/CIE.DS.hjfjmt59",
    verified: checked("CIE_std_illum_D65.csv at 10 nm, 340 to 700 nm", "max absolute difference 0.005, the table's rounding"),
  }),
  airyFactor: c(1.22, "1", {
    source: "First zero of J1 over pi, Airy 1835",
    verified: checked("FFT of a round stop, tests/wave.test.mjs", "first dark ring within 1.5 percent"),
  }),
  electrowettingAngle0: c(160, "deg", { source: "Assumed rest angle, Mugele and Baret 2005 for the form" }),
  electrowettingEpsR: c(3, "1", { source: "Assumed dielectric, Mugele and Baret 2005 for the form" }),
  electrowettingTension: c(0.04, "N/m", { source: "Assumed interfacial tension" }),
  electrowettingThickness: c(1e-6, "m", { source: "Assumed dielectric thickness" }),
  lineF: c(486.1, "nm", { source: "Fraunhofer F line" }),
  lineC: c(656.3, "nm", { source: "Fraunhofer C line" }),
  lined: c(587.6, "nm", { source: "Helium d line" }),
  renderRed: c(630, "nm", { source: "Page choice for the red channel" }),
  renderGreen: c(532, "nm", { source: "Page choice for the green channel" }),
  renderBlue: c(465, "nm", { source: "Page choice for the blue channel" }),
  beePeakGreen: c(544, "nm", { source: "Peitsch et al. 1992" }),
  beePeakBlue: c(436, "nm", { source: "Peitsch et al. 1992" }),
  beePeakUV: c(344, "nm", { source: "Peitsch et al. 1992" }),
  beeInterommatidial: c(1.9, "deg", { source: "Land 1997" }),
  labDelta: c(0.008856, "1", { source: "CIE 15, CIELAB threshold" }),
  machadoMatrices: c("core/spectra.js MACH", "1", { source: "Machado, Oliveira and Fernandes 2009, severity 1" }),
  srgbMatrices: c("core/spectra.js X2R, R2X", "1", { source: "IEC 61966-2-1, D65 white" }),
  woodcockOptical: c(0.71, "1", { source: "Extrapolation length for diffusion, Ishimaru" }),
  hstR1: c(11.04, "m", { source: "Burrows, SPIE 1494, 1991" }),
  hstK1: c(-1.0022985, "1", { source: "Burrows, SPIE 1494, 1991" }),
  hstKFlaw: c(-1.0139, "1", { source: "Burrows et al. 1991" }),
  keckR: c(34.974, "m", { source: "Keck Technical Note 163" }),
  keckK: c(-1.0037963, "1", { source: "COMSOL Keck model" }),
  f2Nd: c(1.62, "1", {
    source: SCHOTT,
    verified: checked("SCHOTT overview, F2", "1.62004 rounds to this"),
  }),
  f2Vd: c(36.37, "1", { source: SCHOTT, verified: checked("SCHOTT overview, F2", "equal") }),
  sk16Nd: c(1.6204, "1", {
    source: "SK16 as entered with the Cooke triplet",
    note: "SCHOTT lists N-SK16 at 1.62041, 60.32; SK16 itself is not in the 2025 table.",
  }),
  sk16Vd: c(60.33, "1", { source: "SK16 as entered with the Cooke triplet" }),
  airSoundSpeed: c(343, "m/s", { source: "Dry air near 20 C, handbook value" }),
  copperResistivity: c(1.724e-5, "ohm*mm", { source: "IACS annealed copper standard" }),
  copperConductivity: c(390, "W/m/K", { source: "Handbook value, entered from memory" }),
  fr4Conductivity: c(0.3, "W/m/K", { source: "Handbook value, entered from memory; in-plane is often higher" }),
  bk7Nd: c(1.5168, "1", { source: SCHOTT, verified: checked("SCHOTT overview, N-BK7", "equal") }),
  bk7Vd: c(64.17, "1", { source: SCHOTT, verified: checked("SCHOTT overview, N-BK7", "equal") }),
};

const m = (value, unit, source, verified) => c(value, unit, { source, ...(verified ? { verified } : {}) });
const ALPHA_UNIT = "1"; // per scene unit, with one unit read as 10 cm unless noted

/** Rows in page order. Numbers are constants; text and switches stay plain. */
const MATERIAL_RECORDS = {
  custom: { name: "Custom", source: "Set by the viewer" },
  glass: {
    name: "Crown glass N-BK7",
    nd: PHYSICS.bk7Nd,
    V: PHYSICS.bk7Vd,
    alpha: m([0.0012, 0.0009, 0.0011], ALPHA_UNIT, "SCHOTT N-BK7 datasheet"),
    source: "SCHOTT N-BK7 datasheet",
  },
  water: {
    name: "Water",
    nd: m(1.333, "1", "Daimon and Masumura 2007", checked(RII, "Hale and Querry 1973 record 1.3325; within the page rounding")),
    V: m(55.8, "1", "Daimon and Masumura 2007"),
    alpha: m([0.045, 0.0065, 0.0019], ALPHA_UNIT, "Pope and Fry 1997"),
    source: "Daimon and Masumura 2007 for the index; Pope and Fry 1997 for absorption",
  },
  diamond: {
    name: "Diamond",
    nd: m(2.4173, "1", "Phillip and Taft 1964", checked(RII, "record 2.41683, difference 4.7e-4")),
    V: m(55.3, "1", "Phillip and Taft 1964"),
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Phillip and Taft 1964",
  },
  ice: {
    name: "Ice",
    nd: m(1.3098, "1", "Warren and Brandt 2008", checked(RII, "record 1.30975")),
    V: m(71, "1", "Read from the Warren and Brandt 2008 index table"),
    alpha: m([0.05, 0.008, 0.0015], ALPHA_UNIT, "Warren and Brandt 2008"),
    source: "Warren and Brandt 2008, index and absorption; V read from their index table",
  },
  amber: {
    name: "Amber",
    nd: m(1.54, "1", "GIA gem reference"),
    V: m(50, "1", "Assumed: no published dispersion found"),
    alpha: m([0.05, 0.28, 1.1], ALPHA_UNIT, "Assumed: chosen to match a clear honey amber"),
    source:
      "Index: GIA gem reference. No published dispersion or absorption found, so V and alpha here are assumed values chosen to match a clear honey amber",
  },
  soap: {
    name: "Soap film",
    film: true,
    source:
      "Airy reflectance of a thin film with n 1.33, Born and Wolf section 7.6. Reflectance is scaled 2.5 times so the colours read at normal view",
  },
  quartz: {
    name: "Quartz, crystal",
    nd: m(1.5443, "1", "Ghosh 1999", checked(RII, "record 1.5443")),
    dne: m(0.0091, "1", "Ghosh 1999"),
    V: m(69.9, "1", "Ghosh 1999"),
    bire: true,
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Ghosh 1999, no 1.5443, ne 1.5534 at 589 nm",
  },
  calcite: {
    name: "Calcite, crystal",
    nd: m(1.6584, "1", "Ghosh 1999", checked(RII, "record 1.65844")),
    dne: m(-0.172, "1", "Ghosh 1999"),
    V: m(48.8, "1", "Ghosh 1999"),
    bire: true,
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Ghosh 1999, no 1.6584, ne 1.4864 at 589 nm",
  },
  sapphire: {
    name: "Sapphire, crystal",
    nd: m(1.7682, "1", "Malitson and Dodge 1972", checked(RII, "record 1.76814")),
    dne: m(-0.0078, "1", "Malitson and Dodge 1972"),
    V: m(72.2, "1", "Malitson and Dodge 1972"),
    bire: true,
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Malitson and Dodge 1972, no 1.7682, ne 1.7604",
  },
  fluorite: {
    name: "Fluorite, crystal (cubic)",
    nd: m(1.4338, "1", "Malitson 1963", checked(RII, "Li 1980 record 1.43385")),
    V: m(95.2, "1", "Malitson 1963"),
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Malitson 1963. Cubic, so it has no birefringence",
  },
};

const materialRows = {};
for (const [id, r] of Object.entries(MATERIAL_RECORDS))
  for (const k of ["nd", "V", "dne", "alpha"]) if (r[k]) materialRows[`mat.${id}.${k}`] = r[k];

const CONSTANTS = { ...PHYSICS, ...materialRows };

const DERIVED = checked("Double-precision ray trace, tests/train.test.mjs", "focal length within tolerance of the derived value");
const preset = (source, verified = false, note = "") => c(0, "1", { source, verified, note: note || undefined });
/** One row per instrument prescription. Designs hand derived and re-traced are verified; entered numbers are not. */
const PRESET_PROVENANCE = {
  refractor: preset("Hand derived thin achromat, Kingslake, Lens Design Fundamentals", DERIVED),
  cooke: preset("Cooke 40 degree sample distributed with Zemax, entered from memory", false, "Focal length from rays matches 50, which checks the sum of the numbers, not each one."),
  microscope: preset("Hand derived from aplanatic points, Born and Wolf section 4.2.3"),
  newton: preset("Hand derived: parabola of radius 2f; layout after Newton, 1672", DERIVED),
  cass: preset("Hand derived, Rutten and van Venrooij, Telescope Optics", DERIVED),
  hst: preset("Design values cited in the preset note: Burrows 1991, COMSOL Hubble model"),
  hstflaw: preset("Measured conic cited from Burrows et al. 1991"),
  paul: preset("Hand derived from Paul, 1935", DERIVED),
  gregorian: preset("Hand derived, Rutten and van Venrooij", DERIVED),
  keck: preset("Keck Technical Note 163; COMSOL Keck model"),
  wolter: preset("Hand derived from Wolter, 1952", DERIVED),
};

return { MATERIAL_RECORDS, CONSTANTS };
})();
// ---- packages/rooms/core/fields.js (sha256 44f98783ab56b99d31471a1bc95cab67bf3f3581a0df6e8e7965865ca75cff4b)
const { FIELDS } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= World fields
// Each field is the body of n2f(p), with r, x, y, z in scope. Sources in the note beside it.
const FIELDS = {
  fisheye: {
    name: "Maxwell fisheye, all space",
    body: "float q=1.+r*r/(uA2*uA2);return 4./(q*q);",
    note: "Rays are great circles of a 3-sphere by stereographic projection (Maxwell, 1854; Born and Wolf section 4.2.2). The world wraps: every ray from you passes through your antipode, then returns to you, so your own marker fills what would be sky.",
    room: 0,
    bg: -1,
    K: 0,
    opl: 1,
    cam: [0, 0, -1.1],
    hh: 0.02,
    steps: 800,
  },
  luneburg: {
    name: "Luneburg room",
    body: "float R=3.;return r<R?2.-r*r/(R*R):1.;",
    note: "A Luneburg ball of radius 3 with no surface: index meets 1 at its edge (Luneburg, 1944). Parallel light entering focuses on the far rim.",
    room: 1,
    bg: 6,
    K: 0,
    cam: [0, 0, -5],
    hh: 0.03,
    steps: 500,
  },
  eaton: {
    name: "Eaton potential at the centre",
    body: "float R=2.5;return r<R?max(2.*R/max(r,.02)-1.,.01):1.;",
    note: "Eaton index n squared = 2R/r minus 1 (Eaton, 1952), the Kepler and hydrogen potential shape with its singular centre. Light close to the axis turns back on itself.",
    room: 1,
    bg: 6,
    K: 0,
    cam: [0, 0, -5],
    hh: 0.015,
    steps: 900,
  },
  gravity: {
    name: "Weak gravity around a mass",
    body: "float n=1.+2.*uM/max(r,1e-3);return n*n;",
    note: "Index n = 1 + 2GM/(r c^2), the weak field form (Eddington, Space Time and Gravitation, 1920). Accurate when GM/(r c^2) is much less than 1; near the sphere at high mass it is only a picture.",
    room: 0,
    bg: 1,
    K: 0.06,
    cam: [0, 0, -9],
    hh: 0.03,
    steps: 700,
  },
  mirage: {
    name: "Atmosphere mirage layers",
    body: "return 1.+uLay*tanh((y+1.45)/.12);",
    note: "A layer step in n squared near the ground (Lehn, 1979, on mirage ducts). Strength is exaggerated about a thousand times over real air so the effect fits the room. Positive strength is a hot road (inferior mirage); negative is a cold sea (superior mirage).",
    room: 1,
    bg: 900,
    K: 0,
    cam: [0, -1.05, -8],
    hh: 0.05,
    steps: 1100,
  },
  formula: {
    name: "Typed n^2 formula",
    note: "The formula box in Lens mode, used over all space. Formula text is checked by the same grammar.",
    room: 1,
    bg: 8,
    K: 0,
    cam: [0, 0, -4],
    hh: 0.03,
    steps: 500,
  },
};

return { FIELDS };
})();
// ---- superframe/lib/medium/grid.mjs (sha256 c514e1b8f471e72983a116640ab7044b3a9f3315d0c2b583578c8b36b4ffe83a)
const { advect, diffuse, project, confine } = (() => {
// lib/medium/grid.mjs: the numerical core of the medium. A collocated grid of cells, Stam's stable fluids
// (semi-Lagrangian advection, implicit diffusion, Jacobi pressure projection) generalised in three ways the medium
// needs: a per-cell viscosity field (honey and water in one tank), a phase mask that splits the tank into two fluids
// (water and air) with the interface acting as a wall for the pressure solve, and vorticity confinement scaled by a
// per-cell turbulence field. Fixed iteration counts and no randomness, so a run is byte-repeatable (QUALITY-SPEC M4).
// Coordinates: x right, y down, cell (i, j) at index j * nx + i.

// the water's own pigment diffusion rate (cells^2 per s at grid scale); a pour's props.spread scales it
const KAPPA = 0.12;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

function bilerp(f, nx, ny, x, y) {
  x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001);
  const i = x | 0, j = y | 0, a = x - i, b = y - j, k = j * nx + i;
  return (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + nx] * (1 - a) + f[k + nx + 1] * a) * b;
}

// Semi-Lagrangian advection of q by (u, v) over dt, cells of the other phase untouched (mask: 1 where q lives).
function advect(q, u, v, nx, ny, dt, out, mask = null) {
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (mask && !mask[k]) { out[k] = 0; continue; }
    out[k] = bilerp(q, nx, ny, i - dt * u[k], j - dt * v[k]);
  }
  return out;
}

// Implicit diffusion with a per-cell coefficient (cells per second squared times dt), Jacobi, inside the mask.
function diffuse(q, coef, nx, ny, iters, tmp, mask = null) {
  if (typeof coef !== 'number') return diffuseFlux(q, coef, nx, ny, tmp, mask);
  const base = Float32Array.from(q);
  for (let it = 0; it < iters; it++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (mask && !mask[k]) { tmp[k] = q[k]; continue; }
      const n = nb(q, nx, ny, i, j, k, mask);
      tmp[k] = (base[k] + coef * n.sum) / (1 + coef * n.count);
    }
    q.set(tmp);
  }
  return q;
}
// A per-cell coefficient: explicit flux through each face at the mean of the two cells, in as many substeps as keep
// it stable. What one cell gives, its neighbour takes, so the total is kept to float rounding. (The Jacobi form with
// a per-cell rate destroyed mass where fast cells met slow ones: a bloom ink lost over 90% of its pigment in 3 s,
// found 2026-10-25. A later gain of up to 20% was advection's, not this step's; medium.mjs renormalises for it.)
function diffuseFlux(q, coef, nx, ny, tmp, mask) {
  let amax = 0; for (let k = 0; k < coef.length; k++) if (coef[k] > amax) amax = coef[k];
  const sub = Math.max(1, Math.ceil(amax * 4 / 0.9));
  for (let s = 0; s < sub; s++) {
    tmp.set(q);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (mask && !mask[k]) continue;
      // each face once: right and down neighbours
      for (const kk of [i < nx - 1 ? k + 1 : -1, j < ny - 1 ? k + nx : -1]) {
        if (kk < 0 || (mask && !mask[kk])) continue;
        const f = 0.5 * (coef[k] + coef[kk]) / sub * (q[kk] - q[k]);
        tmp[k] += f; tmp[kk] -= f;
      }
    }
    q.set(tmp);
  }
  return q;
}
function nb(q, nx, ny, i, j, k, mask) {
  let sum = 0, count = 0;
  if (i > 0 && (!mask || mask[k - 1])) { sum += q[k - 1]; count++; }
  if (i < nx - 1 && (!mask || mask[k + 1])) { sum += q[k + 1]; count++; }
  if (j > 0 && (!mask || mask[k - nx])) { sum += q[k - nx]; count++; }
  if (j < ny - 1 && (!mask || mask[k + nx])) { sum += q[k + nx]; count++; }
  return { sum, count };
}

// Pressure projection within each phase: phase[k] is 1 (water) or 0 (air); a neighbour of the other phase, a solid
// cell or the tank edge is a wall (zero normal velocity, Neumann pressure). solid: 1 where nothing flows (bed, glass).
function project(u, v, phase, solid, nx, ny, iters, p, div) {
  const same = (k, m) => phase[k] === phase[m] && !solid[m];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; p[k] = 0;
    if (solid[k]) { div[k] = 0; continue; }
    const ue = i < nx - 1 && same(k, k + 1) ? u[k + 1] : -u[k], uw = i > 0 && same(k, k - 1) ? u[k - 1] : -u[k];
    const vs = j < ny - 1 && same(k, k + nx) ? v[k + nx] : -v[k], vn = j > 0 && same(k, k - nx) ? v[k - nx] : -v[k];
    div[k] = -0.5 * (ue - uw + vs - vn);
  }
  for (let it = 0; it < iters; it++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (solid[k]) continue;
    let s = 0, c = 0;
    for (const m of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < ny - 1 ? k + nx : -1]) if (m >= 0 && same(k, m)) { s += p[m]; c++; }
    p[k] = c ? (div[k] + s) / c : 0;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (solid[k]) { u[k] = 0; v[k] = 0; continue; }
    const pe = i < nx - 1 && same(k, k + 1) ? p[k + 1] : p[k], pw = i > 0 && same(k, k - 1) ? p[k - 1] : p[k];
    const ps = j < ny - 1 && same(k, k + nx) ? p[k + nx] : p[k], pn = j > 0 && same(k, k - nx) ? p[k - nx] : p[k];
    u[k] -= 0.5 * (pe - pw); v[k] -= 0.5 * (ps - pn);
    // walls: no flow into the other phase, a solid or the tank edge
    if ((i === 0 && u[k] < 0) || (i === nx - 1 && u[k] > 0)) u[k] = 0;
    if ((j === ny - 1 || (j < ny - 1 && (solid[k + nx] || phase[k + nx] !== phase[k]))) && v[k] > 0) v[k] *= 0.2;
    if ((j === 0 || (j > 0 && (solid[k - nx] || phase[k - nx] !== phase[k]))) && v[k] < 0) v[k] *= 0.2;
  }
}

// Vorticity confinement: puts back the small curls the grid smooths away, scaled per cell (the turbulence field).
function confine(u, v, scale, nx, ny, dt, curl) {
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i; curl[k] = 0.5 * (v[k + 1] - v[k - 1] - (u[k + nx] - u[k - nx])); }
  for (let j = 2; j < ny - 2; j++) for (let i = 2; i < nx - 2; i++) {
    const k = j * nx + i, e = typeof scale === 'number' ? scale : scale[k]; if (!e) continue;
    let gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1])), gy = 0.5 * (Math.abs(curl[k + nx]) - Math.abs(curl[k - nx]));
    const l = Math.hypot(gx, gy) + 1e-6; gx /= l; gy /= l;
    u[k] += dt * e * gy * curl[k]; v[k] -= dt * e * gx * curl[k];
  }
}

return { advect, diffuse, project, confine };
})();
// ---- packages/rooms/solvers/sound/fdtd.js (sha256 238d721fb81058d82fc0f55673ff645c99a89a9ae4e233c1e8b052042389d994)
const { WaveField } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// CPU reference for the room's wave step: the same second-order update as the step shader, on any grid. Walls are
// rigid mirrors: a wall neighbour contributes the cell's own pressure, as in the shader.
class WaveField {
  constructor(nx, ny, { cfl = 0.5, damp = 0, wall = () => false } = {}) {
    Object.assign(this, { nx, ny, k: cfl, damp });
    this.p = new Float64Array(nx * ny);
    this.q = new Float64Array(nx * ny);
    this.w = new Uint8Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) this.w[y * nx + x] = wall(x + 0.5, y + 0.5) ? 1 : 0;
  }
  step(src = null, amp = 0) {
    const { nx, ny, p, q, w, k, damp } = this;
    const next = new Float64Array(nx * ny);
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        const i = y * nx + x;
        if (w[i]) continue;
        const c = p[i];
        let s = 0;
        for (const j of [i + 1, i - 1, i + nx, i - nx]) s += w[j] ? c : p[j];
        next[i] = (2 - damp) * c - (1 - damp) * q[i] + k * k * (s - 4 * c);
      }
    if (src) {
      const R = 6;
      for (let y = Math.max(1, src[1] - R | 0); y < Math.min(ny - 1, src[1] + R); y++)
        for (let x = Math.max(1, src[0] - R | 0); x < Math.min(nx - 1, src[0] + R); x++) {
          const r2 = (x + 0.5 - src[0]) ** 2 + (y + 0.5 - src[1]) ** 2;
          next[y * nx + x] += amp * Math.exp(-r2 / 4);
        }
    }
    this.q = p;
    this.p = next;
  }
  at(x, y) {
    return this.p[Math.round(y) * this.nx + Math.round(x)];
  }
}
/** The page's click: a second-derivative pulse centred on step 20. */
const click = (i, amp = 0.2) => {
  const u = (i - 20) / 6;
  return i < 60 ? amp * (1 - 2 * u * u) * Math.exp(-u * u) : 0;
};
/** Windowed single-frequency amplitude of a recording; the page's mode reader. */
function amplitudeAt(s, f, dt) {
  let a = 0,
    b = 0;
  const n = s.length,
    w = 2 * Math.PI * f * dt;
  for (let i = 0; i < n; i++) {
    const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    a += s[i] * h * Math.cos(w * i);
    b += s[i] * h * Math.sin(w * i);
  }
  return Math.hypot(a, b);
}
/** Rectangular room modes, c/2 * hypot(m/Lx, q/Ly). */
const roomMode = (c, Lx, Ly, m, q) => (c / 2) * Math.hypot(m / Lx, q / Ly);

return { WaveField };
})();
// ---- packages/rooms/solvers/pcb/formulas.js (sha256 1369d75825ad294415ec2919eddb4b93eb3bd5e559f97e51afc4c53ad0ce3595)
const { hammerstad } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Published impedance formulas
function hammerstad(w, h, er) {
  const u = w / h;
  if (u <= 1) {
    const e =
      (er + 1) / 2 + ((er - 1) / 2) * (Math.pow(1 + 12 / u, -0.5) + 0.04 * (1 - u) * (1 - u));
    return { z: (60 / Math.sqrt(e)) * Math.log(8 / u + u / 4), e };
  }
  const e = (er + 1) / 2 + ((er - 1) / 2) * Math.pow(1 + 12 / u, -0.5);
  return { z: (120 * Math.PI) / (Math.sqrt(e) * (u + 1.393 + 0.667 * Math.log(u + 1.444))), e };
}
function ipc2141(w, h, t, er) {
  return (87 / Math.sqrt(er + 1.41)) * Math.log((5.98 * h) / (0.8 * w + t));
}

return { hammerstad };
})();
// ---- packages/rooms/solvers/pcb/constants.js (sha256 9cbcf1ffc0096cd9f390bc1fad01fdadbc59732754577253ba714b3fa55a3278)
const { STACKS } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Constants, sourced where noted
const RHO_CU = CONSTANTS.copperResistivity.value;
// ohm mm, annealed copper standard (IACS)
const K_CU = CONSTANTS.copperConductivity.value,
  K_FR4 = CONSTANTS.fr4Conductivity.value;
// W/mK. Typical handbook values, from memory; FR4 in-plane is often higher
const STACKS = {
  2: { cu: [0.03556, 0.03556], diel: [1.529], er: 4.5, mat: "FR4 KB6167F", plating: 0.025 },
  4: {
    cu: [0.04318, 0.01727, 0.01727, 0.04318],
    diel: [0.1999, 0.9906, 0.1999],
    er: 3.61,
    mat: "FR408-HR",
    plating: 0.025,
  },
};
const RULES = {
  2: {
    name: "OSH Park 2 layer",
    trace: 0.1524,
    space: 0.1524,
    drill: 0.254,
    ring: 0.127,
    edge: 0.381,
    web: 0.1016,
    source: "docs.oshpark.com/services/two-layer",
  },
  4: {
    name: "OSH Park 4 layer",
    trace: 0.127,
    space: 0.127,
    drill: 0.254,
    ring: 0.1016,
    edge: 0.381,
    web: 0.1016,
    source: "docs.oshpark.com/services/four-layer",
  },
};
const DES = {
  w: 0.2,
  clr: 0.2,
  via: 0.3,
  viaPad: 0.6,
  pourClr: 0.25,
  antipad: 0.3,
  planeInset: 0.5,
  maskGrow: 0.05,
  g: 0.2,
};
const UNBUILT =
  "UNBUILT. No board has been made from this file. A fabricator CAM check is required before any order.";
function rng32(s) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function layerZ(layers) {
  const st = STACKS[layers],
    z = [];
  let top = 0;
  for (const c of st.cu) top += c;
  for (const t of st.diel) top += t;
  let y = top / 2;
  for (let i = 0; i < layers; i++) {
    z.push({ top: y, bot: y - st.cu[i] });
    y -= st.cu[i] + (st.diel[i] || 0);
  }
  return { z, total: top };
}

return { STACKS };
})();
// ---- packages/rooms/maps/map.js (sha256 f15f414734e9485626b7a9709587da71e09f3acb86ddefd84cb1b8b139b45786)
const { statusFrom } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// A map between two domains, as a typed object that can fail. An analogy states a likeness; a map states which
// quantities correspond, with units, what stays preserved, over what range, what a round trip loses, one prediction it
// can get wrong, and the condition that would show it wrong. Status comes from a rule on that test.

const BASES = "MLTIK$Nb"; // mass length time current temperature money count bit

/** "M L2 T-2" to exponents. Fractions as decimals are enough for the groups used here. */
function parseUnit(s = "") {
  const out = {};
  for (const tok of String(s).trim().split(/\s+/).filter(Boolean)) {
    const b = tok[0];
    if (!BASES.includes(b)) throw new Error(`unknown base ${b} in "${s}"`);
    out[b] = (out[b] || 0) + (tok.length > 1 ? Number(tok.slice(1)) : 1);
  }
  for (const k of Object.keys(out)) if (Math.abs(out[k]) < 1e-12) delete out[k];
  return out;
}

function groupResidual(expr, table) {
  const out = {};
  for (const [sym, p] of Object.entries(expr)) {
    if (!(sym in table)) throw new Error(`no unit for ${sym}`);
    for (const [b, e] of Object.entries(parseUnit(table[sym]))) out[b] = (out[b] || 0) + e * p;
  }
  for (const k of Object.keys(out)) if (Math.abs(out[k]) < 1e-12) delete out[k];
  return out;
}

/** Every group claimed dimensionless, checked by exponent. Returns the list of faults. */
function unitFaults(map) {
  const ta = Object.fromEntries(map.quantities.map((q) => [q.a, q.a_unit]));
  const tb = Object.fromEntries(map.quantities.map((q) => [q.b, q.b_unit]));
  const bad = [];
  for (const g of map.groups) {
    if (g.expr_a && Object.keys(groupResidual(g.expr_a, ta)).length) bad.push(`${g.name}: side a carries units`);
    if (g.expr_b && Object.keys(groupResidual(g.expr_b, tb)).length) bad.push(`${g.name}: side b carries units`);
  }
  return bad;
}

const STATUS = ["homology", "broken", "analogy"];

/** The rule. A pass never sets shared mechanism, which stays its own field. */
function statusFrom({ held_out_pass, passed_region, break_point }) {
  if (held_out_pass === null || held_out_pass === undefined) return "analogy";
  if (break_point && passed_region) return "broken";
  if (held_out_pass && !break_point) return "homology";
  return "analogy";
}

/** The author's nine words. Each is true, false or null (not run). There is no total, so none can become a target. */
const WORDS = ["cross_applicable", "renderable", "interpretable", "perceptible", "applicable", "testable", "measurable", "fallible", "disprovable"];

const REQUIRED = ["id", "domains", "family", "quantities", "groups", "preserved", "invariants", "claimed_range", "failure_condition", "held_out", "status", "shared_mechanism", "words", "bits_lost"];

/** Faults in a map record. An empty list means the object states everything a map must state. */
function mapFaults(m) {
  const bad = REQUIRED.filter((k) => !(k in m)).map((k) => `missing ${k}`);
  if (bad.length) return bad;
  if (!STATUS.includes(m.status)) bad.push(`status ${m.status}`);
  if (m.status === "broken" && !m.break_point) bad.push("broken needs the point where it breaks");
  if (m.status === "homology" && !(m.value <= m.threshold || m.higher_is_better)) bad.push("homology needs a held-out pass");
  for (const w of WORDS) if (!(w in m.words)) bad.push(`word ${w} missing`);
  if ("score" in m || "total" in m.words) bad.push("a map carries no total");
  return bad.concat(unitFaults(m));
}

return { statusFrom };
})();
// ---- packages/world/properties.mjs (sha256 6de38fb28938dad32023b1fbd79b48817f51e0339f94d264ab6266f1e46b721c)
const { CORES, DYE_N2, SOUND_N2, BOARD, lensProfile, traceZ0, PROPERTIES } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// properties.mjs: the property registry of the field. Each property is a capability any element can carry at a
// weight, and each is the core of a package that already exists, used as it stands: nothing here re-derives what the
// package computes. The record of each property is a propertyObject (rooms/properties/model.js): its state space,
// its operations, the physical elements that perform them and a fabrication route with its limits. `core` names
// the package, the file and the exports the property runs on, so tests/parity.test.mjs can hold every one in place.

// The cores, gathered so scene.mjs reaches every package through this one door.
const CORES = Object.freeze({ rk4, advect, diffuse, project, confine, WaveField, hammerstad, statusFrom, instrument, plainLabel });

const rec = (p) => Object.freeze({ ...propertyObject(p.record), core: Object.freeze(p.core), reads: p.reads, gives: p.gives, limits: Object.freeze(p.limits) });
const nd = (material) => MATERIAL_RECORDS[material]?.nd?.value;

// Dye in water raises its index the way dissolved sugar does; 0.2 of n^2 at full dye is about n 1.40 over water's
// 1.333. The figure is chosen to make the moving dye visible, not read from a measured solution.
const DYE_N2 = 0.2;
// A pressure wave changes density and so the index (the acousto-optic effect). The coupling is exaggerated many
// times over real water so the ripples bend light visibly; the form, a change in n^2 in proportion to pressure, holds.
const SOUND_N2 = 0.35;
// The board the circuit property lays: the two-layer stack of the PCB core, its trace drawn at w/h = 1.9.
const BOARD = Object.freeze({ h: STACKS[2].diel[0], w: 1.9 * STACKS[2].diel[0], er: STACKS[2].er, mat: STACKS[2].mat });

// n^2 an element would give at a point if it carried the lens fully: its own profile in its own frame.
function lensProfile(el, px, py, dye = 0) {
  const r = Math.hypot(px - el.x, py - el.y), R = el.radius, kind = el.traits.profile || "material";
  if (kind === "luneburg") return luneburgN2(r, R);
  if (kind === "eaton") return r < R ? Math.min(6, Math.max((2 * R) / Math.max(r, 0.02 * R) - 1, 0.01)) : 1;
  const n = nd(el.traits.material || "water");
  if (!Number.isFinite(n)) throw new Error(`lens: ${el.id} names the material "${el.traits.material}", which the constants table lacks`);
  return n * n + DYE_N2 * dye;
}
// Microstrip impedance on a substrate whose permittivity is the field's n^2 there, plus the board where the circuit
// property lays one: er = n^2 + s * (er_board - 1). Hammerstad's formula, from the PCB core.
const traceZ0 = (n2, s) => hammerstad(BOARD.w, BOARD.h, n2 + s * (BOARD.er - 1)).z;

const PROPERTIES = Object.freeze({
  lens: rec({
    record: { id: "lens", name: "Refraction", stateSpace: { name: "Index of refraction squared over the plane", shape: "scalar field n^2(x, y)", coordinates: { chosen: true, name: "scene x, y", note: "Rays follow x'' = grad(n^2) / 2, with |x'| = n." } },
      operations: [{ id: "bend", name: "Bend a ray by the index gradient", element: "a graded-index medium (Luneburg, Eaton) or a uniform glass or water" }],
      fabrication: { route: "Graded-index glass by ion exchange, or stepped shells of uniform glasses (findings F210)", limits: ["A real Luneburg lens is built in steps; the field draws the smooth profile", "Dispersion is not modelled: one wavelength", "No reflection at the rim; the rim is a gradient"] } },
    core: { package: "rooms", file: "packages/rooms/core/trace.js", exports: ["rk4"], also: [["packages/rooms/core/fields.js", "FIELDS"], ["packages/rooms/core/constants.js", "MATERIAL_RECORDS"]] },
    reads: ["dye", "pressure"], gives: ["n2", "rays"],
    limits: [`Luneburg n^2 = 2 - r^2/R^2 (${FIELDS.luneburg.name}); Eaton as in ${FIELDS.eaton.name}`, `water n ${nd("water")} and glass n ${nd("glass")} from the constants table`],
  }),
  flow: rec({
    record: { id: "flow", name: "Flow", stateSpace: { name: "Incompressible velocity and a carried dye", shape: "vector field u(x, y) and scalar dye q(x, y)", coordinates: { chosen: true, name: "grid cells" } },
      operations: [{ id: "carry", name: "Carry dye along the flow, spread it, keep the flow divergence-free", element: "a stirred liquid" }],
      fabrication: { route: "A stirred tank of water with dye", limits: ["Stam's stable fluids on a coarse grid: diffusive at small scales", "Semi-Lagrangian advection does not conserve dye; the total is renormalised", "Two dimensions"] } },
    core: { package: "superframe medium", file: "superframe/lib/medium/grid.mjs", exports: ["advect", "diffuse", "project", "confine"], also: [["creation/lib/gen/advect.mjs", "advect"]] },
    reads: [], gives: ["velocity", "dye"],
    limits: ["Outside what carries flow the water is held still; across the rim it slows smoothly"],
  }),
  measure: rec({
    record: { id: "measure", name: "Measurement", stateSpace: { name: "Readings over what carries the property", shape: "weighted means with spread", coordinates: { chosen: true, name: "the units of each reading" } },
      operations: [{ id: "read", name: "Read the field where the property is carried, weighted by its strength", element: "a probe, or anything given the property" }],
      fabrication: { route: "The instrument pipeline in packages/instruments: principle, twin, front end, calibration", limits: ["Every reading here is simulated: its state stays potential until a physical part is measured", "Spread is over the region, not a calibrated uncertainty"] } },
    core: { package: "rooms properties, instruments", file: "packages/rooms/properties/model.js", exports: ["instrument", "plainLabel"], also: [["packages/instruments/schemas/receipt.schema.json", "receipt"]] },
    reads: ["n2", "velocity", "dye", "pressure", "z0"], gives: ["numbers"],
    limits: ["A weight of 0 everywhere means nothing is read, and the readout says so"],
  }),
  shape: rec({
    record: { id: "shape", name: "Shape", stateSpace: { name: "Dimensions of what carries the property", shape: "centroid, two diameters, an angle, an area", coordinates: { chosen: true, name: "scene units, one unit read as 100 mm" } },
      operations: [{ id: "dimension", name: "Dimension a region by its second moments", element: "a drawing with a toleranced dimension" }],
      fabrication: { route: "The CAD model in packages/diagram/cad: parts, drawing, tolerances, exports", limits: ["Diameters are of the equivalent ellipse (exact for a uniform ellipse)", "A dimension without a tolerance is refused, as the CAD core refuses one"] } },
    core: { package: "diagram cad", file: "packages/diagram/cad/src/param.js", exports: ["hasTol"], also: [["packages/diagram/cad/src/blueprint.js", "dims"]] },
    reads: ["presence", "dye"], gives: ["dims"],
    limits: ["Tolerance is half a grid cell plus the spread a rim adds"],
  }),
  sound: rec({
    record: { id: "sound", name: "Voice", stateSpace: { name: "Acoustic pressure", shape: "scalar wave field p(x, y, t)", coordinates: { chosen: true, name: "grid cells and steps" } },
      operations: [{ id: "sound", name: "Drive a wave and let it travel", element: "a speaker in a medium" }],
      fabrication: { route: "The wave step of the sound core (rooms/solvers/sound)", limits: ["Second-order finite differences, CFL 0.5", "Sound speed is one value everywhere", "The light coupling is exaggerated"] } },
    core: { package: "rooms sound", file: "packages/rooms/solvers/sound/fdtd.js", exports: ["WaveField"] },
    reads: [], gives: ["pressure"],
    limits: ["The pressure bends light where the lens is carried and where it is not alike: sound changes the medium itself"],
  }),
  map: rec({
    record: { id: "map", name: "Territory", stateSpace: { name: "Where a point is against where it is seen", shape: "a displacement field", coordinates: { chosen: true, name: "a graticule laid on the scene", note: "The grid is a lens for reading positions; the field's structure is continuous under it." } },
      operations: [{ id: "graticule", name: "Draw the scene's coordinates as the light carries them", element: "a reference grid seen through the medium" }],
      fabrication: { route: "A printed grid behind a tank, photographed", limits: ["Thin-sheet displacement: the bend a ray takes crossing the scene, not a full trace per point"] } },
    core: { package: "rooms maps", file: "packages/rooms/maps/map.js", exports: ["statusFrom", "WORDS"] },
    reads: ["n2"], gives: ["displacement"],
    limits: [`The map from object to image here has no held-out test yet, so its status is ${statusFrom({ held_out_pass: null })}`],
  }),
  circuit: rec({
    record: { id: "circuit", name: "Circuitry", stateSpace: { name: "A trace's characteristic impedance", shape: "Z0 at the probe", coordinates: { chosen: true, name: "ohms" } },
      operations: [{ id: "trace", name: "Lay a microstrip on the medium", element: "a copper trace over a dielectric" }],
      fabrication: { route: `The PCB core's two-layer stack: ${BOARD.mat}, er ${BOARD.er}, ${BOARD.h} mm dielectric`, limits: ["At optical frequencies a medium's permittivity is n^2; a board works at radio frequencies, where the same material differs. The reading shows a trace on a medium whose permittivity equals the field's n^2", "Hammerstad's quasi-static formula"] } },
    core: { package: "rooms pcb", file: "packages/rooms/solvers/pcb/formulas.js", exports: ["hammerstad"], also: [["packages/rooms/solvers/pcb/constants.js", "STACKS"]] },
    reads: ["n2"], gives: ["z0"],
    limits: ["Read at the probe; the copper is drawn under it"],
  }),
});

return { CORES, DYE_N2, SOUND_N2, BOARD, lensProfile, traceZ0, PROPERTIES };
})();
// ---- packages/world/scene-read.mjs (sha256 29f15ce27f16bb79fe5a55243e4b69d55dd7cb9fe57237513696d8b06ba7daef)
const { hasTol, measureField, dimsOf } = (() => {
// SPDX-License-Identifier: FSL-1.1-MIT
// scene-read.mjs: what the measure and shape properties take from a scene. Measurement is a weighted read over
// everything that carries it, so a probe reads a point and a body of water given the property reads itself whole.
// Shape dimensions what carries it by its second moments, and every dimension carries a tolerance or it is refused,
// by the rule of the CAD core (packages/diagram/cad/src/param.js, C.hasTol; tests/parity.test.mjs holds this copy to it).

// The CAD core's rule, word for word: a dimension has plus-minus, unilateral, basic, reference or limits.
const hasTol = (t) => !!t && (t.pm !== undefined || (t.plus !== undefined && t.minus !== undefined) || t.basic === true || t.ref === true || (Array.isArray(t.limits) && t.limits.length === 2));

const fmt = (v, d) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d));
// [id, name, unit, decimals, value at cell k]
function quantities(s, traceZ0) {
  const { g, size: { nx, w, mmPerUnit, stepsPerSecond } } = s, hc = w / nx;
  const grad = (k) => { const i = k % nx, gx = (g.n2[Math.min(k + 1, g.n2.length - 1)] - g.n2[Math.max(k - 1, 0)]) / (2 * hc), gy = (g.n2[Math.min(k + nx, g.n2.length - 1)] - g.n2[Math.max(k - nx, 0)]) / (2 * hc); return i === 0 || i === nx - 1 ? 0 : Math.hypot(gx, gy) / 2; };
  return [
    ["n", "index", "", 3, (k) => Math.sqrt(g.n2[k])],
    ["grad", "index gradient", "per 100 mm", 2, grad],
    ["speed", "flow speed", "mm/s", 1, (k) => Math.hypot(g.u[k], g.v[k]) * hc * mmPerUnit * stepsPerSecond],
    ["dye", "dye", "of full", 2, (k) => g.dye[k]],
    ["pressure", "sound pressure", "of the drive", 2, (k) => s.wave.p[k] / 0.05],
    ["z0", "trace impedance", "ohm", 1, (k) => traceZ0(g.n2[k], g.s.circuit[k])],
  ];
}

function measureField(s, { traceZ0 }) {
  const W = s.g.s.measure, n = W.length;
  let sum = 0, sq = 0, circ = 0;
  for (let k = 0; k < n; k++) { sum += W[k]; sq += W[k] * W[k]; circ += W[k] * s.g.s.circuit[k]; }
  const ids = s.els.filter((e) => e.carries.measure > 0).map((e) => e.id);
  if (sum < 1e-9) return { readings: [], weight: 0, nEff: 0, instrument: null, label: "Nothing carries measurement, so nothing is read." };
  const readings = quantities(s, traceZ0).map(([id, name, unit, d, at]) => {
    let m = 0;
    for (let k = 0; k < n; k++) if (W[k]) m += W[k] * at(k);
    m /= sum;
    let v = 0;
    for (let k = 0; k < n; k++) if (W[k]) { const e = at(k) - m; v += W[k] * e * e; }
    const spread = Math.sqrt(v / sum), show = id !== "z0" || circ / sum > 1e-3;
    return { id, name, value: m, spread, unit, show, text: `${fmt(m, d)}${unit ? ` ${unit}` : ""} (spread ${fmt(spread, d)})` };
  });
  const finite = readings.every((r) => Number.isFinite(r.value));
  const ins = CORES.instrument({ property: "measure", elements: ids, path: "a weighted read over the measuring region", verdict: { check: "every reading is a finite number", pass: finite }, limits: ["simulated, not a measured part"] });
  return { readings, weight: sum * (s.size.w / s.size.nx) ** 2, nEff: (sum * sum) / sq, instrument: ins, label: CORES.plainLabel(ins) };
}

// Second moments of q = shape strength, with dye adding mass where the flow carries it.
function dimsOf(s) {
  const { g, els, size: { nx, ny, w, mmPerUnit } } = s, hc = w / nx;
  let M = 0, mx = 0, my = 0;
  const q = (k) => g.s.shape[k] * (1 + g.dye[k] * g.s.flow[k]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const m = q(j * nx + i); M += m; mx += m * (i + 0.5); my += m * (j + 0.5); }
  if (M < 1e-6) return null;
  mx /= M; my /= M;
  let xx = 0, yy = 0, xy = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const m = q(j * nx + i), dx = i + 0.5 - mx, dy = j + 0.5 - my; xx += m * dx * dx; yy += m * dy * dy; xy += m * dx * dy; }
  xx = xx / M + 1 / 12; yy = yy / M + 1 / 12; xy /= M;   // + 1/12: each cell is a square, not a point
  const tr = (xx + yy) / 2, det = Math.sqrt(Math.max(0, ((xx - yy) / 2) ** 2 + xy * xy)), l1 = tr + det, l2 = Math.max(0, tr - det);
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy), carriers = els.filter((e) => e.carries.shape > 0), wsum = carriers.reduce((a, e) => a + e.carries.shape, 0);
  const rim = wsum ? carriers.reduce((a, e) => a + e.carries.shape * e.edge, 0) / wsum : 0, pm = (0.5 * hc + 0.25 * rim) * mmPerUnit;
  const dim = (id, label, units) => { const value = units * mmPerUnit, d = { id, label, value, unit: "mm", tol: { pm }, text: `${value.toFixed(0)} mm ± ${pm.toFixed(1)}` }; if (!hasTol(d.tol)) throw new Error(`shape: ${id} has no tolerance`); return d; };
  const major = dim("major", "long diameter", 4 * Math.sqrt(l1) * hc), minor = dim("minor", "short diameter", 4 * Math.sqrt(l2) * hc);
  return { centroid: [mx * hc, my * hc], angle, major, minor, area: M * hc * hc * mmPerUnit * mmPerUnit, dims: [major, minor] };
}

return { hasTol, measureField, dimsOf };
})();
// ---- packages/world/scene.mjs (sha256 f1493a2cd881db55ea63c80cabb9f9b910c884a6708c15d927debd54c3fff842)
const { SIZE, DEFAULTS, createScene, bilerp } = (() => {
const NAMES = PROPERTY_IDS;
// SPDX-License-Identifier: FSL-1.1-MIT
// scene.mjs: one continuous scene in the field. Light crosses a Luneburg glass and a body of stirred water; a probe
// reads the water; the water is dimensioned; a voice sends a wave through all of it; a graticule shows where things
// are against where they are seen. None of these is a room: each is a property some element carries at a weight, and
// every element can carry every property. Pure: no DOM, no clock, no randomness, so a test and a page agree.
//
//   const s = createScene();        the default elements; s.elements is the list, each with .carries and .x, .y
//   s.step();                       one step of flow, dye and sound, then the field is worked out again
//   s.trace()                       the rays, as polylines in scene units, with each ray's turn in degrees
//   s.read()                        what the measuring elements read, with spread, units and the instrument's state
//   s.dims()                        the toleranced dimensions of what carries shape
//   s.describe()                    the scene in words

const SIZE = Object.freeze({ w: 2, h: 1.2, nx: 100, ny: 60, mmPerUnit: 100, stepsPerSecond: 60 });
const TAU = 2 * Math.PI;

const DEFAULTS = Object.freeze([
  { id: "glass", name: "Glass", x: 0.62, y: 0.6, radius: 0.3, edge: 0.06, carries: { lens: 1 }, traits: { profile: "luneburg", material: "glass" } },
  { id: "water", name: "Water", x: 1.3, y: 0.6, radius: 0.36, edge: 0.08, carries: { lens: 1, flow: 1, shape: 1 }, traits: { material: "water" } },
  { id: "probe", name: "Probe", x: 1.3, y: 0.6, radius: 0.07, edge: 0.03, carries: { measure: 1 }, traits: { material: "water" } },
  { id: "voice", name: "Voice", x: 0.95, y: 0.16, radius: 0.08, edge: 0.03, carries: { sound: 0.4 }, traits: { material: "water" } },
  { id: "ground", name: "Ground", x: 1, y: 0.6, radius: 1.4, edge: 0.2, carries: { map: 0.35 }, traits: { material: "water" } },
]);

function createScene({ elements = DEFAULTS, size = SIZE } = {}) {
  const { nx, ny, w, h } = size, n = nx * ny, hc = w / nx;
  const els = elements.map((e) => element(structuredClone(e)));
  const F32 = () => new Float32Array(n);
  const g = { u: F32(), v: F32(), dye: F32(), p: F32(), div: F32(), curl: F32(), tmp: F32(), tmp2: F32(), conf: F32(), n2: F32(),
    phase: new Uint8Array(n).fill(1), solid: new Uint8Array(n), masks: new Map(), s: Object.fromEntries(NAMES.map((p) => [p, F32()])) };
  const wave = new CORES.WaveField(nx, ny, { cfl: 0.5, damp: 0.015 });
  const s = { size, els, g, wave, t: 0, get elements() { return els; } };
  const cx = (i) => (i + 0.5) * hc, cy = (j) => (j + 0.5) * hc;

  // masks and strengths: every element's soft region, then each property's union over the elements
  s.field = () => {
    for (const el of els) {
      const m = g.masks.get(el.id) || g.masks.set(el.id, F32()).get(el.id);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { m[j * nx + i] = disc(cx(i) - el.x, cy(j) - el.y, el.radius, el.edge); }
    }
    for (const p of NAMES) { const S = g.s[p]; S.fill(0); for (const el of els) { const wgt = el.carries[p]; if (!wgt) continue; const m = g.masks.get(el.id); for (let k = 0; k < n; k++) S[k] = union2(S[k], carry(m[k], wgt)); } }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g.n2[j * nx + i] = s.n2Point(cx(i), cy(j));
    return s;
  };
  // n^2 at any point: each lens carrier's own profile, worked out where the ray is, so a ray bends smoothly through a
  // lens; only the dye and the pressure, which live on the grid, are interpolated between cells.
  s.n2Point = (x, y) => {
    const gx = x / hc - 0.5, gy = y / hc - 0.5, dye = bilerp(g.dye, nx, ny, gx, gy), pr = bilerp(wave.p, nx, ny, gx, gy);
    let st = 0, acc = 0, v = 0;
    for (const el of els) {
      const wgt = el.carries.lens; if (!wgt) continue;
      const c = carry(disc(x - el.x, y - el.y, el.radius, el.edge), wgt); if (c <= 0) continue;
      st = union2(st, c); v = mix2(acc, v, c, lensProfile(el, x, y, dye)); acc += c;
    }
    return Math.max(0.5, n2Blend(st, acc > 0 ? v : 1) + SOUND_N2 * pr);
  };

  s.step = () => { stepFlow(s); stepSound(s); s.t++; return s.field(); };
  s.n2At = (x, y) => bilerp(g.n2, nx, ny, x / hc - 0.5, y / hc - 0.5);
  s.trace = (rays = 17) => traceRays(s, rays);
  s.read = () => measureField(s, { traceZ0 });
  s.dims = () => dimsOf(s);
  s.describe = () => describe(s);
  s.set = (id, patch) => { const el = els.find((e) => e.id === id); if (!el) throw new Error(`scene: no element ${id}`); Object.assign(el, patch.carries ? { ...patch, carries: { ...el.carries, ...patch.carries } } : patch); return s.field(); };
  return s.field();
}

function bilerp(f, nx, ny, x, y) {
  x = Math.min(nx - 1.001, Math.max(0, x)); y = Math.min(ny - 1.001, Math.max(0, y));
  const i = x | 0, j = y | 0, a = x - i, b = y - j, k = j * nx + i;
  return (1 - b) * ((1 - a) * f[k] + a * f[k + 1]) + b * ((1 - a) * f[k + nx] + a * f[k + nx + 1]);
}

// Flow: each element carrying flow stirs the water around a centre that wanders, and pours dye at a point that circles.
// The stable-fluids core moves it; outside what carries flow the water is held still, across the rim it slows smoothly.
function stepFlow(s) {
  const { g, els, size: { nx, ny, w } } = s, hc = w / nx, n = nx * ny, F = g.s.flow;
  for (const el of els) {
    const wgt = el.carries.flow; if (!wgt) continue;
    const m = g.masks.get(el.id), ph = s.t * 0.021, ox = el.x + 0.35 * el.radius * Math.cos(ph), oy = el.y + 0.35 * el.radius * Math.sin(ph * 1.3);
    const px = el.x + 0.55 * el.radius * Math.cos(-ph * 1.7), py = el.y + 0.55 * el.radius * Math.sin(-ph * 1.7);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, c = carry(m[k], wgt); if (c <= 0) continue;
      const dx = (i + 0.5) * hc - ox, dy = (j + 0.5) * hc - oy, r2 = (dx * dx + dy * dy) / (el.radius * el.radius);
      const swirl = 0.05 * c * Math.exp(-r2 * 1.5) / el.radius;
      g.u[k] += -dy * swirl; g.v[k] += dx * swirl;
      const ex = (i + 0.5) * hc - px, ey = (j + 0.5) * hc - py, pour = Math.exp(-(ex * ex + ey * ey) / (0.0025 * el.radius / 0.36));
      g.dye[k] = Math.min(1.2, g.dye[k] + 0.06 * c * pour);
    }
  }
  for (let k = 0; k < n; k++) g.conf[k] = 0.25 * F[k];
  CORES.confine(g.u, g.v, g.conf, nx, ny, 1, g.curl);
  g.tmp.set(g.u); g.tmp2.set(g.v);
  CORES.advect(g.tmp, g.tmp, g.tmp2, nx, ny, 1, g.u); CORES.advect(g.tmp2, g.tmp, g.tmp2, nx, ny, 1, g.v);
  CORES.project(g.u, g.v, g.phase, g.solid, nx, ny, 16, g.p, g.div);
  for (let k = 0; k < n; k++) { const hold = 1 - 0.25 * (1 - F[k]); g.u[k] *= 0.996 * hold; g.v[k] *= 0.996 * hold; }
  g.tmp.set(g.dye); CORES.advect(g.tmp, g.u, g.v, nx, ny, 1, g.dye);
  CORES.diffuse(g.dye, 0.02, nx, ny, 2, g.tmp, null);
  for (let k = 0; k < n; k++) g.dye[k] *= 0.9985 - 0.03 * (1 - F[k]);
}
// Sound: the elements carrying sound drive one wave at their weighted centre, with the summed weight as its strength.
function stepSound(s) {
  const { els, wave, size: { nx, w } } = s, hc = w / nx;
  let a = 0, x = 0, y = 0;
  for (const el of els) { const c = el.carries.sound; if (!c) continue; a += c; x += c * el.x; y += c * el.y; }
  wave.step(a > 0 ? [x / a / hc, y / a / hc] : null, a > 0 ? 0.05 * a * Math.sin((TAU * s.t) / 24) : 0);
}

// Rays: parallel light from the left, each integrated by the lens core's RK4 step of x'' = grad(n^2) / 2.
function traceRays(s, rays) {
  const { w, h } = s.size, dt = 0.01, out = [];
  const n2 = (q) => s.n2Point(q[0], q[1]);
  for (let r = 0; r < rays; r++) {
    let p = [0.005, (h * (r + 0.5)) / rays, 0], v = [Math.sqrt(n2(p)), 0, 0];
    const pts = [[p[0], p[1]]];
    for (let k = 0; k < 600 && p[0] < w && p[0] >= 0 && p[1] >= 0 && p[1] <= h; k++) {
      ({ p, v } = CORES.rk4(p, v, dt, n2));
      if (k % 3 === 2) pts.push([p[0], p[1]]);
    }
    pts.push([p[0], p[1]]);
    out.push({ points: pts, turn: (Math.atan2(v[1], v[0]) * 180) / Math.PI });
  }
  return out;
}

function describe(s) {
  const rays = s.trace(), turned = rays.filter((r) => Math.abs(r.turn) > 1), most = rays.reduce((a, r) => (Math.abs(r.turn) > Math.abs(a.turn) ? r : a), rays[0]);
  const say = [`Light enters from the left in ${rays.length} rays; ${turned.length} leave turned by more than a degree, the most by ${Math.abs(most.turn).toFixed(0)} degrees.`];
  const carried = NAMES.map((p) => [p, s.els.filter((e) => e.carries[p] > 0).map((e) => `${e.name.toLowerCase()} at ${Math.round(e.carries[p] * 100)} percent`)]).filter(([, l]) => l.length);
  say.push(carried.map(([p, l]) => `${PROPERTIES[p].name} is carried by ${l.join(" and ")}.`).join(" "));
  const r = s.read();
  if (r.readings.length) say.push(`The measuring region reads ${r.readings.filter((q) => q.show).map((q) => `${q.name} ${q.text}`).join(", ")}.`);
  else say.push("Nothing carries measurement, so nothing is read.");
  const d = s.dims();
  if (d) say.push(`The shaped region is ${d.major.text} by ${d.minor.text}.`);
  return say.join(" ");
}

return { SIZE, DEFAULTS, createScene, bilerp };
})();
export { PROPERTY_IDS, clamp01, smooth, disc, carry, union2, mix2, luneburgN2, n2Blend, micro, kernelTable, element, carryAt, strength, mixture, largestStep, continuity, CORES, DYE_N2, SOUND_N2, BOARD, lensProfile, traceZ0, PROPERTIES, hasTol, measureField, dimsOf, SIZE, DEFAULTS, createScene, bilerp };
