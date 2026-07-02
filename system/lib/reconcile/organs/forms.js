// Form organs -- point clouds / curves. Each make(p) returns { kind:"points", points, recipe }:
// points feed the features; the recipe is the portable render description. Ported from the atelier +
// studio-engine point generators.
const rad = (d) => d * Math.PI / 180;

export const phyllotaxis = {
  id: "phyllotaxis", label: "Phyllotaxis", kind: "points",
  params: [{ k: "angle", min: 110, max: 165, step: 0.1, def: 137.5 }, { k: "scale", min: 5, max: 16, step: 0.1, def: 9 }],
  axes: ["golden_angle", "balance", "coverage", "complexity"],
  make(p) {
    const a = rad(p.angle), N = 700, pts = [];
    for (let i = 0; i < N; i++) { const r = p.scale * Math.sqrt(i); pts.push([r * Math.cos(i * a), r * Math.sin(i * a), i]); }
    return { kind: "points", points: pts, recipe: { mode: "spiral", angle_deg: p.angle, scale: p.scale, count: N } };
  },
};

export const attractor = {
  id: "attractor", label: "Attractor (de Jong)", kind: "points",
  params: [{ k: "a", min: -2.5, max: 2.5, step: 0.05, def: 1.7 }, { k: "b", min: -2.5, max: 2.5, step: 0.05, def: 1.7 },
  { k: "c", min: -2.5, max: 2.5, step: 0.05, def: 0.6 }, { k: "d", min: -2.5, max: 2.5, step: 0.05, def: 1.2 }],
  axes: ["balance", "coverage", "complexity"],
  make(p) {
    let x = 0.1, y = 0.1; const N = 3000, T = 20, pts = [];
    for (let s = 0; s < N; s++) { const nx = Math.sin(p.a * y) - Math.cos(p.b * x), ny = Math.sin(p.c * x) - Math.cos(p.d * y); x = nx; y = ny; if (s >= T) pts.push([x, y, s - T]); }
    return { kind: "points", points: pts, recipe: { mode: "iterated", init: [0.1, 0.1], transient: T, count: N } };
  },
};

export const harmonograph = {
  id: "harmonograph", label: "Harmonograph", kind: "points",
  params: [{ k: "f1", min: 1, max: 5, step: 0.01, def: 2 }, { k: "f2", min: 1, max: 5, step: 0.01, def: 3 },
  { k: "f3", min: 1, max: 5, step: 0.01, def: 3 }, { k: "f4", min: 1, max: 5, step: 0.01, def: 2 },
  { k: "d1", min: 0.005, max: 0.06, step: 0.001, def: 0.02 }, { k: "d2", min: 0.005, max: 0.06, step: 0.001, def: 0.0285 },
  { k: "phase", min: 0, max: 3.14, step: 0.01, def: 0.5 }],
  axes: ["balance", "coverage", "complexity"],
  make(p) {
    const T = 60, N = 4000, hp = Math.PI / 2;
    const p1 = p.phase, p2 = p.phase + hp + 0.1 * p.f2, p3 = p.phase + Math.PI + 0.1 * p.f3, p4 = p.phase + 3 * hp + 0.1 * p.f4;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = T * i / (N - 1), e1 = Math.exp(-p.d1 * t), e2 = Math.exp(-p.d2 * t);
      const x = Math.sin(p.f1 * t + p1) * e1 + Math.sin(p.f2 * t + p2) * e2;
      const y = Math.sin(p.f3 * t + p3) * e1 + Math.sin(p.f4 * t + p4) * e2;
      pts.push([x, y, i]);
    }
    return { kind: "points", points: pts, recipe: { mode: "parametric", t_max: T, count: N } };
  },
};

export const FORM_ORGANS = [phyllotaxis, attractor, harmonograph];
