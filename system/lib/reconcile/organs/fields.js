// Field organs -- implicit scalar fields as strand exprs. Each make(p) returns
// { kind:"field", expr, t0, animatable, period }: one closed-form source the engine samples for
// features, emits as GLSL, and animates over t. Ported from studio-engine's field generators.
import { c, v, sin, cos, add, mul, sub, div, sqrt } from "../expr.js";

const TAU = 2 * Math.PI;

export const gyroid = {
  id: "gyroid", label: "Gyroid", kind: "field",
  params: [{ k: "freq", min: 2, max: 12, step: 0.5, def: 7 }, { k: "z", min: 0, max: 1, step: 0.05, def: 0.3 }],
  axes: ["clean_freq", "contrast", "complexity"],
  make(p) {
    const f = p.freq, u = v("u"), w = v("v"), t = v("t");
    const expr = add(mul(sin(mul(u, f)), cos(mul(w, f))), mul(sin(mul(w, f)), cos(mul(t, f))), mul(sin(mul(t, f)), cos(mul(u, f))));
    return { kind: "field", expr, t0: p.z, animatable: true, period: TAU / Math.max(1e-6, f) };
  },
};

export const quasicrystal = {
  id: "quasicrystal", label: "Quasicrystal", kind: "field",
  params: [{ k: "waves", min: 3, max: 9, step: 1, def: 5 }, { k: "scale", min: 4, max: 14, step: 0.5, def: 8 }],
  axes: ["fivefold", "contrast", "complexity"],
  make(p) {
    const w = Math.max(1, Math.round(p.waves)), s = p.scale, u = v("u"), vv = v("v"), terms = [];
    for (let k = 0; k < w; k++) { const ang = TAU * k / w; terms.push(cos(add(mul(u, Math.cos(ang) * s), mul(vv, Math.sin(ang) * s), v("t")))); }
    return { kind: "field", expr: add(...terms), t0: 0, animatable: true, period: TAU };
  },
};

export const flowfield = {
  id: "flowfield", label: "Flow field", kind: "field",
  params: [{ k: "scale", min: 2, max: 9, step: 0.5, def: 4.5 }, { k: "warp", min: 0, max: 3, step: 0.1, def: 1.2 }],
  axes: ["contrast", "complexity"],
  make(p) {
    const s = p.scale, w = p.warp, u = v("u"), vv = v("v"), t = v("t");
    const a = sin(add(mul(u, s), mul(w, sin(mul(vv, s))), t));
    const b = cos(add(mul(vv, s), mul(w, cos(mul(u, s))), t));
    return { kind: "field", expr: mul(a, b), t0: 0, animatable: true, period: TAU };
  },
};

export const turbulence = {
  id: "turbulence", label: "Turbulence", kind: "field",
  params: [{ k: "freq", min: 1.5, max: 6, step: 0.5, def: 3 }, { k: "octaves", min: 2, max: 6, step: 1, def: 4 }, { k: "gain", min: 0.35, max: 0.7, step: 0.05, def: 0.55 }],
  axes: ["contrast", "complexity"],
  make(p) {
    const f0 = p.freq, oct = Math.round(p.octaves), g = p.gain, u = v("u"), vv = v("v"), t = v("t"), terms = [];
    let amp = 0;
    for (let o = 0; o < oct; o++) { const fr = f0 * Math.pow(2, o), a = Math.pow(g, o); amp += a; terms.push(mul(a, sin(add(mul(u, fr), sin(mul(vv, fr)), t)), cos(mul(vv, fr)))); }
    return { kind: "field", expr: div(add(...terms), amp || 1), t0: 0, animatable: true, period: TAU };
  },
};

function metaballSeeds(count, spread) {
  const M = 0x100000000; let st = Math.floor(count * 1000 + spread * 100) % M;
  const nx = () => { st = (1664525 * st + 1013904223) % M; return st / M; };
  const out = []; for (let i = 0; i < count; i++) out.push([(nx() * 2 - 1) * 0.7, (nx() * 2 - 1) * 0.7, spread * (0.75 + 0.5 * nx())]);
  return out;
}
export const metaballs = {
  id: "metaballs", label: "Metaballs", kind: "field",
  params: [{ k: "count", min: 3, max: 9, step: 1, def: 5 }, { k: "spread", min: 0.15, max: 0.5, step: 0.01, def: 0.34 }, { k: "falloff", min: 0.02, max: 0.15, step: 0.005, def: 0.06 }],
  axes: ["coverage", "complexity", "balance"],
  make(p) {
    const balls = metaballSeeds(Math.round(p.count), p.spread), u = v("u"), vv = v("v"), terms = [];
    for (const [cx, cy, r] of balls) { const du = sub(u, cx), dv = sub(vv, cy); terms.push(div(c(r * r), add(mul(du, du), mul(dv, dv), c(1e-3)))); }
    return { kind: "field", expr: mul(add(...terms), p.falloff), t0: 0, animatable: false, period: 0 };
  },
};

export const rings = {
  id: "rings", label: "Rings", kind: "field",
  params: [{ k: "freq", min: 3, max: 16, step: 0.5, def: 8 }],
  axes: ["contrast", "complexity", "balance"],
  make(p) {
    const f = p.freq, u = v("u"), vv = v("v");
    return { kind: "field", expr: sin(add(mul(sqrt(add(mul(u, u), mul(vv, vv))), f), v("t"))), t0: 0, animatable: true, period: TAU };
  },
};

export const moire = {
  id: "moire", label: "Moire", kind: "field",
  params: [{ k: "freq", min: 6, max: 22, step: 1, def: 12 }, { k: "angle", min: 0.1, max: 1.4, step: 0.05, def: 0.4 }],
  axes: ["contrast", "complexity"],
  make(p) {
    const f = p.freq, a = p.angle, u = v("u"), vv = v("v"), t = v("t");
    const g1 = sin(add(mul(u, f), t));
    const g2 = sin(add(mul(add(mul(u, Math.cos(a)), mul(vv, Math.sin(a))), f), t));
    return { kind: "field", expr: mul(g1, g2), t0: 0, animatable: true, period: TAU };
  },
};

export const FIELD_ORGANS = [gyroid, quasicrystal, flowfield, turbulence, metaballs, rings, moire];
