// G-buffer renderer and camera paths for "The Salt Road" (dream-sdf.mjs), on the CPU.
// renderFrame(spec, w, h) -> a G-buffer: per pixel the albedo tone, kind (0 sky, 1 emissive, 2
// lit surface), world position, view depth (planar), world normal, the dither anchor (position
// and normal in the object's own space), the object id, shadow visibility for up to four
// lights, and the pixel and depth this surface point had in the previous frame (motion
// vector, exact: the scene knows each object's transform).
import { map, hitId, albedoOf, skyTone, setTowerAngle, towerLocal, TOWER, LIGHTHOUSE, ORBS } from "./dream-sdf.mjs";
import { makeBeam, makeRadial, maskAt, surfaceTerm } from "../ditherlight/lights.mjs";

export const FOV = (70 * Math.PI) / 180;
const nrm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

export function cameraBasis(cam) {
  const cp = Math.cos(cam.pitch), fwd = [Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp], right = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];
  const up = nrm3([right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]);
  return { fwd, right, up };
}
// World point to [pixel x, pixel y, planar depth].
export function project(cam, w, h, P) {
  const b = cameraBasis(cam), v = [P[0] - cam.pos[0], P[1] - cam.pos[1], P[2] - cam.pos[2]], z = v[0] * b.fwd[0] + v[1] * b.fwd[1] + v[2] * b.fwd[2], th = Math.tan(FOV / 2), asp = w / h;
  const u = (v[0] * b.right[0] + v[1] * b.right[1] + v[2] * b.right[2]) / (z * th * asp), s = (v[0] * b.up[0] + v[1] * b.up[1] + v[2] * b.up[2]) / (z * th);
  return [((u + 1) / 2) * w - 0.5, ((1 - s) / 2) * h - 0.5, z];
}

// The four lights of a frame: lantern, two orbs, the lighthouse beam.
export function lightsOf(spec) {
  const c = spec.cam, b = cameraBasis(c), lp = spec.lanternAttached
    ? [c.pos[0] + b.right[0] * 0.35 + b.fwd[0] * 0.4, c.pos[1] - 0.3, c.pos[2] + b.right[2] * 0.35 + b.fwd[2] * 0.4] : spec.lanternPos;
  const a = spec.beamAngle, demo = !!spec.demo, dir = [Math.sin(a) * 0.99, demo ? -0.36 : -0.1, -Math.cos(a) * 0.99];
  // The measurement lights (demo false) are fixed; the evidence in evidence/ditherlight-motion-*.json was made with them.
  const rad = demo ? { r: 9, core: 1.2, I: 3.2 } : { r: 9, core: 1.8, I: 1.5 }, lant = demo ? { r: 8, core: 1.3, I: 3.4 } : { r: 7, core: 1.4, I: 1.6 };
  return [makeRadial({ pos: lp, radius: lant.r, core: lant.core, intensity: lant.I }), makeRadial({ pos: [ORBS[0][0], ORBS[0][1] + 0.3, ORBS[0][2]], radius: rad.r, core: rad.core, intensity: rad.I }),
    makeRadial({ pos: [ORBS[1][0], ORBS[1][1] + 0.3, ORBS[1][2]], radius: rad.r, core: rad.core, intensity: rad.I }),
    makeBeam({ pos: [LIGHTHOUSE.x, LIGHTHOUSE.lanternY, LIGHTHOUSE.z], dir, outerDeg: demo ? 12 : 11, innerDeg: 5, range: demo ? 90 : 60, intensity: demo ? 4 : 3.2, slats: 5, duty: 0.34, phase: 0 })];
}

function normalAt(x, y, z) {
  const e = 0.004, k0 = map(x + e, y - e, z - e), k1 = map(x - e, y - e, z + e), k2 = map(x - e, y + e, z - e), k3 = map(x + e, y + e, z + e);
  return nrm3([k0 - k1 - k2 + k3, -k0 - k1 + k2 + k3, -k0 + k1 - k2 + k3]);
}
function softShadow(p, n, L, maxT) {
  const o = [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03], v = [L[0] - o[0], L[1] - o[1], L[2] - o[2]], dist = Math.hypot(...v), d = [v[0] / dist, v[1] / dist, v[2] / dist], end = dist - maxT;
  let res = 1, t = 0.05;
  for (let i = 0; i < 40 && t < end; i++) { const h = map(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t); if (h < 0.002) return 0; res = Math.min(res, (7 * h) / t); t += Math.max(h, 0.06); }
  return Math.max(0, Math.min(1, res));
}

export function renderFrame(spec, w, h, { rows = null } = {}) {
  const n = w * h, g = { width: w, height: h, albedo: new Float32Array(n), kind: new Uint8Array(n), depth: new Float32Array(n), wpos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), apos: new Float32Array(n * 3), anrm: new Float32Array(n * 3), id: new Uint8Array(n), vis: new Float32Array(n * 4), prev: new Float32Array(n * 3).fill(NaN) };
  const lights = lightsOf(spec), b = cameraBasis(spec.cam), th = Math.tan(FOV / 2), asp = w / h, cam = spec.cam;
  const [y0, y1] = rows || [0, h];
  setTowerAngle(spec.tower);
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, u = (((x + 0.5) / w) * 2 - 1) * asp * th, v = (1 - ((y + 0.5) / h) * 2) * th;
    const d = nrm3([b.fwd[0] + b.right[0] * u + b.up[0] * v, b.fwd[1] + b.right[1] * u + b.up[1] * v, b.fwd[2] + b.right[2] * u + b.up[2] * v]);
    let t = 0.1, hit = false;
    for (let s = 0; s < 110 && t < 140; s++) { const q = map(cam.pos[0] + d[0] * t, cam.pos[1] + d[1] * t, cam.pos[2] + d[2] * t); if (q < 0.0015 * t + 0.001) { hit = true; break; } t += q; }
    if (!hit) {
      g.kind[i] = 0; g.albedo[i] = skyTone(d[0], d[1], d[2], spec.time); g.depth[i] = 40; g.id[i] = 255;
      for (let c = 0; c < 3; c++) { g.apos[i * 3 + c] = d[c] * 40; g.wpos[i * 3 + c] = cam.pos[c] + d[c] * 40; }
      g.anrm[i * 3 + 2] = 1; g.nrm[i * 3 + 1] = 1; continue;
    }
    const P = [cam.pos[0] + d[0] * t, cam.pos[1] + d[1] * t, cam.pos[2] + d[2] * t];
    map(P[0], P[1], P[2]); const id = hitId, N = normalAt(P[0], P[1], P[2]);
    let A = P, AN = N, Pprev = P;
    if (id === 1) {
      const [lx, lz] = towerLocal(P[0], P[2]), [nx, nz] = towerLocal(P[0] + N[0], P[2] + N[2]), [ox, oz] = towerLocal(P[0], P[2]);
      A = [lx, P[1], lz]; AN = [nx - ox, N[1], nz - oz];
      const pc = Math.cos(spec.towerPrev), ps = Math.sin(spec.towerPrev);
      Pprev = [TOWER.cx + pc * lx - ps * lz, P[1], TOWER.cz + ps * lx + pc * lz];
    }
    g.id[i] = id; g.depth[i] = (P[0] - cam.pos[0]) * b.fwd[0] + (P[1] - cam.pos[1]) * b.fwd[1] + (P[2] - cam.pos[2]) * b.fwd[2];
    for (let c = 0; c < 3; c++) { g.wpos[i * 3 + c] = P[c]; g.nrm[i * 3 + c] = N[c]; g.apos[i * 3 + c] = A[c]; g.anrm[i * 3 + c] = AN[c]; }
    g.albedo[i] = albedoOf(id, A[0], A[1], A[2]);
    g.kind[i] = id === 4 || id === 6 ? 1 : 2;
    if (g.kind[i] === 2) for (let k = 0; k < 4; k++) {
      const m = maskAt(lights[k], P);
      if (m > 0 && surfaceTerm(lights[k], P, N) > 0) g.vis[i * 4 + k] = softShadow(P, N, lights[k].pos, k === 3 ? 1.3 : 0.3);
    }
    const pr = project(spec.camPrev, w, h, Pprev); g.prev[i * 3] = pr[0]; g.prev[i * 3 + 1] = pr[1]; g.prev[i * 3 + 2] = pr[2];
  }
  return g;
}

// Camera paths. Each returns frame specs 0 .. n-1; every spec carries the previous frame's
// camera and tower angle for the motion vector. In the measurement paths the lantern and beam
// are fixed in the world (so a surface point's tone is constant in time apart from fog); the
// demo attaches the lantern to the camera and sweeps the beam.
const START = [0, 1.7, 0];
export function camAt(path, i) {
  switch (path) {
    case "static": return { pos: START, yaw: 0, pitch: 0.02 };
    case "dolly": return { pos: [START[0], START[1], START[2] - 0.08 * i], yaw: 0, pitch: 0.02 };
    case "strafe": return { pos: [START[0] + 0.06 * i, START[1], START[2]], yaw: 0, pitch: 0.02 };
    case "yaw": return { pos: START, yaw: -0.25 + ((0.7 * Math.PI) / 180) * i, pitch: 0.02 };
    case "orbit": { const a = ((0.5 * Math.PI) / 180) * i, R = 14; return { pos: [TOWER.cx - Math.sin(a - 0.35) * R, 2.4, TOWER.cz + Math.cos(a - 0.35) * R], yaw: a - 0.35, pitch: 0.12 }; }
    case "spin": return { pos: [0.5, 2.2, -6], yaw: 0.3, pitch: 0.2 };
    default: throw new Error(`unknown path ${path}`);
  }
}
export function pathSpecs(path, n, { fixed = true, lanternAttached = false } = {}) {
  const specs = [], spin = path === "spin" ? (1.2 * Math.PI) / 180 : 0;
  for (let i = 0; i < n; i++) {
    specs.push({ cam: camAt(path, i), camPrev: camAt(path, Math.max(0, i - 1)), tower: spin * i, towerPrev: spin * Math.max(0, i - 1), beamAngle: fixed ? 2.55 : 2.2 + 0.03 * i, time: i, lanternPos: [-0.4, 1.5, -2.5], lanternAttached });
  }
  return specs;
}
