// "Quay Street": a night street in a tidal harbour town after rain, for the lens suite (strong
// point lights on wet ground). Our own scene: facades are analytic planes with procedural
// windows, small objects (lamp posts, bollards, a van) are signed distance fields, the street
// is a plane with puddles, and the road ends at the harbour edge where black water begins.
// Units are metres, y up, the street runs along -z. No imported asset.
import { pcg } from "../common.mjs";

export const STREET = { half: 4.2, kerb: 0.14, facade: 6.4, quayZ: -58, waterY: -1.6, postEvery: 11, postX: 5.0, postH: 5.2 };
const hash = (a, b) => pcg((a | 0) ^ pcg(b | 0)) / 4294967296;
const fract = (x) => x - Math.floor(x), sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function vnoise(x, y) { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (hash(x0, y0) * (1 - sx) + hash(x0 + 1, y0) * sx) * (1 - sy) + (hash(x0, y0 + 1) * (1 - sx) + hash(x0 + 1, y0 + 1) * sx) * sy; }
export const fbm = (x, y) => 0.55 * vnoise(x, y) + 0.3 * vnoise(2.1 * x + 7, 2.1 * y + 3) + 0.15 * vnoise(4.3 * x + 1, 4.3 * y + 9);

// Building height per block of 9 m on each side.
export const blockHeight = (side, z) => 7 + 7 * hash(side * 31 + 5, Math.floor(-z / 9));
// Lamps: posts on alternating sides; sodium on the left, a cooler white on the right.
export function lamps() {
  const out = [];
  for (let k = 0; k < 6; k++) {
    const side = k % 2 ? 1 : -1, z = -4 - k * STREET.postEvery;
    out.push({ pos: [side * (STREET.postX - 1.1), STREET.postH, z], side, z, rgb: side < 0 ? [1, 0.55, 0.18] : [0.75, 0.85, 1], I: side < 0 ? 26 : 20, r: 0.16 });
  }
  return out;
}
// The van: drives toward the camera along the left lane; headlights at the front.
export function van(t) { const z = -40 + 5.5 * t; return { x: -1.9, z, lights: [[-2.55, 0.8, z + 2.5], [-1.25, 0.8, z + 2.5]] }; }

const box = (px, py, pz, bx, by, bz, r = 0) => { const qx = Math.abs(px) - bx, qy = Math.abs(py) - by, qz = Math.abs(pz) - bz; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r; };
const capY = (px, py, pz, h, r) => { const y = Math.min(Math.max(py, 0), h); return Math.hypot(px, py - y, pz) - r; };
export let hitId = 0;

// Small objects as one distance field; ids: 1 post, 2 lamp head (emissive), 3 bollard, 4 van body, 5 headlight (emissive), 6 rope rail.
export function objects(x, y, z, vanState) {
  let d = 1e9; hitId = 0;
  // posts (domain repetition along z, side chosen per cell)
  const cell = Math.round((z + 4) / -STREET.postEvery), zc = -4 - cell * STREET.postEvery;
  if (cell >= 0 && cell < 6) {
    const side = cell % 2 ? 1 : -1, px = x - side * STREET.postX, pz = z - zc;
    const pole = capY(px, y - STREET.kerb, pz, STREET.postH - STREET.kerb, 0.07); if (pole < d) { d = pole; hitId = 1; }
    const arm = box(x - side * (STREET.postX - 0.55), y - STREET.postH - 0.1, pz, 0.55, 0.04, 0.04); if (arm < d) { d = arm; hitId = 1; }
    const head = Math.hypot(x - side * (STREET.postX - 1.1), y - STREET.postH, pz) - 0.16; if (head < d) { d = head; hitId = 2; }
  }
  // bollards along the quay edge
  if (z < STREET.quayZ + 2 && z > STREET.quayZ - 1) {
    const bx = x - (Math.round(x / 2.2) * 2.2), b = capY(bx, y, z - (STREET.quayZ + 0.6), 0.75, 0.22); if (b < d) { d = b; hitId = 3; }
    const rail = Math.hypot(y - 0.62 + 0.12 * Math.cos((2 * Math.PI * x) / 2.2), z - (STREET.quayZ + 0.6)) - 0.025; if (rail < d) { d = rail; hitId = 6; }
  }
  // van
  if (vanState) {
    const vx = x - vanState.x, vz = z - vanState.z;
    const body = Math.min(box(vx, y - 1.05, vz, 0.95, 0.75, 2.3, 0.18), box(vx, y - 2.05, vz + 0.4, 0.9, 0.35, 1.7, 0.12)); if (body < d) { d = body; hitId = 4; }
    for (const L of vanState.lights) { const h = Math.hypot(x - L[0], y - L[1], z - L[2]) - 0.13; if (h < d) { d = h; hitId = 5; } }
  }
  return d;
}

// Facade appearance at a point on the plane x = side * facade: albedo and window emission.
export function facadeAt(side, y, z, t) {
  const fy = y / 3.1, fz = -z / 2.6, cy = Math.floor(fy), cz = Math.floor(fz), u = fract(fz), v = fract(fy);
  const inWin = cy >= 1 && u > 0.22 && u < 0.78 && v > 0.25 && v < 0.85;
  const shop = cy === 0 && u > 0.08 && u < 0.92 && v > 0.12 && v < 0.8 && hash(cz * 3 + side, 77) < 0.35;
  const lit = hash(cz + side * 101, cy * 7 + 3) < 0.28, flick = 0.9 + 0.1 * Math.sin(t * 3 + cz);
  const base = 0.11 + 0.06 * hash(cz >> 2, side + 9) + 0.04 * fbm(z * 0.7, y * 0.9);
  if (shop) { const k = (0.35 + 0.35 * hash(cz, 5)) * (1.1 - 0.8 * v) * (0.75 + 0.25 * Math.sin(u * 19 + cz)); return { albedo: [0.05, 0.05, 0.05], emit: [0.9, 0.62, 0.34].map((c) => c * k) }; }
  const hue = hash(cz * 5 + side, cy * 11), warm = hue < 0.8 ? [0.55, 0.36, 0.17] : [0.18, 0.26, 0.42], lv = 0.25 + 0.9 * hash(cz, cy) ** 2;
  const frame = inWin && (u < 0.27 || u > 0.73 || v < 0.3 || v > 0.8);
  if (inWin && !frame) return { albedo: [0.03, 0.035, 0.04], emit: lit ? warm.map((c) => c * flick * lv) : [0, 0, 0], glass: !lit };
  if (frame) return { albedo: [0.05, 0.045, 0.04], emit: [0, 0, 0] };
  return { albedo: [base * 1.05, base * 0.95, base * 0.85], emit: [0, 0, 0] };
}
// Ground at (x, z): wetness 0..1 (1 = standing water), albedo, and a bump for the normal.
export function groundAt(x, z) {
  const p = fbm(x * 0.35 + 3, z * 0.22), puddle = sat((p - 0.52) * 9), cob = Math.abs(x) > STREET.half;
  const tex = 0.05 + 0.03 * fbm(x * 4, z * 4) + (cob ? 0.04 * hash(Math.floor(x * 2.5), Math.floor(z * 2.5)) : 0);
  const line = !cob && Math.abs(x) < 0.07 && fract(-z / 4) < 0.55 ? 0.25 : 0;
  return { wet: Math.max(puddle, 0.55), albedo: [tex + line, tex + line, tex * 0.95 + line], bump: 0.04 * (fbm(x * 9, z * 3) - 0.5) * (1 - puddle) };
}
export const skyAt = (d) => { const h = Math.max(0, d[1]); return [0.012 + 0.02 * (1 - h), 0.016 + 0.024 * (1 - h), 0.03 + 0.03 * (1 - h)].map((c) => c * (0.8 + 0.4 * fbm(d[0] * 6 / (h + 0.3), d[2] * 6 / (h + 0.3)))); };
