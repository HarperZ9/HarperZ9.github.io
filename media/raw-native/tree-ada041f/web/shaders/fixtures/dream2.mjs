// G-buffer renderer for the second Salt Road (dream2-sdf.mjs): the same outputs as dream.mjs plus
// `haze`, the light scattered toward the camera along each view ray (beam shafts, glow around the
// lamps), integrated from the lights with a height-falling density.
import { map, hitId, albedoOf, skyTone, setSpin, setExact, spireLocal, SPIRE, LIGHTHOUSE2, ORBS2 } from "./dream2-sdf.mjs";
import { makeBeam, makeRadial, maskAt, surfaceTerm } from "../ditherlight/lights.mjs";
import { cameraBasis, project, FOV } from "./dream.mjs";

export { cameraBasis, project, FOV };
const nrm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

// Lights of a frame: the lantern in hand (flickering), two orbs, the lighthouse beam; the other
// orbs only glow. spec: { cam, beamAngle, flicker, time }.
export function lightsOf2(spec) {
  const c = spec.cam, b = cameraBasis(c), f = 1 + 0.12 * (spec.flicker ?? 0);
  const lp = [c.pos[0] + b.right[0] * 0.3 + b.fwd[0] * 0.5, c.pos[1] - 0.25, c.pos[2] + b.right[2] * 0.3 + b.fwd[2] * 0.5];
  const a = spec.beamAngle, dir = [Math.sin(a) * 0.9, -0.42, -Math.cos(a) * 0.9];
  return [makeRadial({ pos: lp, radius: 10, core: 1.5, intensity: 2.6 * f, wrap: 0.25 }), makeRadial({ pos: [ORBS2[0][0], ORBS2[0][1] + 0.3, ORBS2[0][2]], radius: 12, core: 1.7, intensity: 2.8 }),
    makeRadial({ pos: [ORBS2[1][0], ORBS2[1][1] + 0.3, ORBS2[1][2]], radius: 12, core: 1.7, intensity: 2.8 }),
    makeBeam({ pos: [LIGHTHOUSE2.x, LIGHTHOUSE2.lanternY, LIGHTHOUSE2.z], dir, outerDeg: 10, innerDeg: 3.5, range: 95, intensity: 6, slats: 6, duty: 0.3, phase: 0 })];
}
// Lights that only glow (no surface term, no shadow): the two far orbs.
const glowLights = () => [makeRadial({ pos: [ORBS2[2][0], ORBS2[2][1] + 0.2, ORBS2[2][2]], radius: 9, core: 1.0, intensity: 3 }), makeRadial({ pos: [ORBS2[3][0], ORBS2[3][1] + 0.2, ORBS2[3][2]], radius: 9, core: 1.0, intensity: 3 })];

function normalAt(x, y, z) {
  const e = 0.004, k0 = map(x + e, y - e, z - e), k1 = map(x - e, y - e, z + e), k2 = map(x - e, y + e, z - e), k3 = map(x + e, y + e, z + e);
  return nrm3([k0 - k1 - k2 + k3, -k0 - k1 + k2 + k3, -k0 + k1 - k2 + k3]);
}
function softShadow(p, n, L, maxT) {
  const o = [p[0] + n[0] * 0.04, p[1] + n[1] * 0.04, p[2] + n[2] * 0.04], v = [L[0] - o[0], L[1] - o[1], L[2] - o[2]], dist = Math.hypot(...v), d = [v[0] / dist, v[1] / dist, v[2] / dist], end = dist - maxT;
  let res = 1, t = 0.06;
  for (let i = 0; i < 44 && t < end; i++) { const h = map(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t); if (h < 0.003) return 0; res = Math.min(res, (7 * h) / t); t += Math.max(h, 0.07); }
  return Math.max(0, Math.min(1, res));
}
const HAZE = { steps: 22, far: 55, density: 0.04, scale: 4, gainBeam: 1.3, gainRadial: 0.1 };

export function renderFrame2(spec, w, h) {
  const n = w * h, g = { width: w, height: h, albedo: new Float32Array(n), kind: new Uint8Array(n), depth: new Float32Array(n), wpos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), apos: new Float32Array(n * 3), anrm: new Float32Array(n * 3), id: new Uint8Array(n), vis: new Float32Array(n * 4), prev: new Float32Array(n * 3).fill(NaN), haze: new Float32Array(n) };
  const lights = lightsOf2(spec), glow = glowLights(), all = [...lights, ...glow], b = cameraBasis(spec.cam), th = Math.tan(FOV / 2), asp = w / h, cam = spec.cam;
  setSpin(spec.spin ?? 0); setExact(false);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, u = (((x + 0.5) / w) * 2 - 1) * asp * th, v = (1 - ((y + 0.5) / h) * 2) * th;
    const d = nrm3([b.fwd[0] + b.right[0] * u + b.up[0] * v, b.fwd[1] + b.right[1] * u + b.up[1] * v, b.fwd[2] + b.right[2] * u + b.up[2] * v]);
    let t = 0.1, hit = false;
    for (let s = 0; s < 140 && t < 150; s++) { const q = map(cam.pos[0] + d[0] * t, cam.pos[1] + d[1] * t, cam.pos[2] + d[2] * t); if (q < 0.0015 * t + 0.001) { hit = true; break; } t += q; }
    let tEnd = HAZE.far;
    if (!hit) {
      g.kind[i] = 0; g.albedo[i] = skyTone(d[0], d[1], d[2], spec.time); g.depth[i] = 40; g.id[i] = 255;
      for (let c = 0; c < 3; c++) { g.apos[i * 3 + c] = d[c] * 40; g.wpos[i * 3 + c] = cam.pos[c] + d[c] * 40; }
      g.anrm[i * 3 + 2] = 1; g.nrm[i * 3 + 1] = 1;
    } else {
      const P = [cam.pos[0] + d[0] * t, cam.pos[1] + d[1] * t, cam.pos[2] + d[2] * t];
      map(P[0], P[1], P[2]); const id = hitId; setExact(true); const N = normalAt(P[0], P[1], P[2]);
      let A = P, AN = N;
      if (id === 3 || id === 4) { const [lx, lz] = spireLocal(P[0], P[2]), [nx, nz] = spireLocal(P[0] + N[0], P[2] + N[2]), [ox, oz] = spireLocal(P[0], P[2]); A = [lx, P[1], lz]; AN = [nx - ox, N[1], nz - oz]; void oz; }
      g.id[i] = id; g.depth[i] = (P[0] - cam.pos[0]) * b.fwd[0] + (P[1] - cam.pos[1]) * b.fwd[1] + (P[2] - cam.pos[2]) * b.fwd[2]; tEnd = Math.min(t, HAZE.far);
      for (let c = 0; c < 3; c++) { g.wpos[i * 3 + c] = P[c]; g.nrm[i * 3 + c] = N[c]; g.apos[i * 3 + c] = A[c]; g.anrm[i * 3 + c] = AN[c]; }
      g.albedo[i] = albedoOf(id, A[0], A[1], A[2]);
      g.kind[i] = id === 8 || id === 13 ? 1 : 2;
      if (g.kind[i] === 2) for (let k = 0; k < 4; k++) { const m = maskAt(lights[k], P); if (m > 0 && surfaceTerm(lights[k], P, N) > 0) g.vis[i * 4 + k] = softShadow(P, N, lights[k].pos, k === 3 ? 1.6 : 0.35); }
      setExact(false);
    }
    // light scattered along the ray, from every light, with a density that falls with height
    let acc = 0; const dt = tEnd / HAZE.steps;
    for (let s = 0; s < HAZE.steps; s++) {
      const tt = (s + 0.5) * dt, px = cam.pos[0] + d[0] * tt, py = cam.pos[1] + d[1] * tt, pz = cam.pos[2] + d[2] * tt, dens = HAZE.density * Math.exp(-Math.max(py, 0) / HAZE.scale), P3 = [px, py, pz];
      let l = 0; for (let k = 0; k < all.length; k++) { const m = maskAt(all[k], P3); if (m > 0) l += Math.min(m, 2.5) * (all[k].kind === "beam" ? HAZE.gainBeam : HAZE.gainRadial); }
      acc += dens * l * dt;
    }
    g.haze[i] = 1 - Math.exp(-acc);
  }
  return g;
}
void SPIRE;
