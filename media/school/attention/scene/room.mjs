// The lamp room at the top of Tallow's lighthouse: the night beyond the glazing (far, so it moves
// slowly when the camera moves), the curved glazing bars, the floor, the great Fresnel lens, the
// word cards pinned to the glass, and Tallow. Depth (z) gives parallax on every camera move.
import { rect, circle, polyline, contour, lin, rad, pose, GUIDES, C, rng, words, smooth01 } from "./lib.mjs";

export const LENS = { x: 1080, y: 590, r: 210 };
export const TALLOW = { x: 380, y: 1010, s: 0.62 };
const ZFAR = 600, ZGLASS = 160, ZCARD = 0, ZNEAR = -120;

// Where card i of n sits: in a gently bowed row along the upper glazing, in sentence order. The
// card's width shrinks so any sentence up to the model's context fits across the frame.
export function cardAt(i, n) {
  const step = Math.min(200, 1600 / n), u = n > 1 ? i / (n - 1) : 0.5, x = 960 + (i - (n - 1) / 2) * step;
  return { x, y: 230 + 70 * (2 * u - 1) * (2 * u - 1), z: ZCARD, w: Math.min(184, step - 14), tilt: (u - 0.5) * 0.12 };
}

// The night outside: a halftone moon, stars, the sea and the lights of the coast's other lessons.
export function night(t, { moon = true } = {}) {
  const r = rng(11), out = [{ shape: rect(0, 0, 1920, 1080), fill: lin(0, 0, 0, 640, [0, "#02030a"], [1, "#0c1424"]), screen: true }];
  for (let i = 0; i < 220; i++) out.push({ shape: circle(-700 + r() * 3300, -400 + r() * 920, 1 + r() * 1.6, 6), fill: [0.9, 0.88, 0.8, 0.25 + 0.5 * r()], z: ZFAR });
  // The moon as a dot screen: dot size follows the lit fraction of a sphere lit from the left.
  const mx = 1830, my = 330, mr = 100;
  if (moon) for (let y = -mr; y <= mr; y += 11) for (let x = -mr; x <= mr; x += 11) {
    const d = Math.hypot(x, y) / mr; if (d > 1) continue;
    const nz = Math.sqrt(1 - d * d), lit = Math.max(0, (-0.55 * x / mr + 0.3 * -y / mr + 0.78 * nz));
    if (lit > 0.05) out.push({ shape: circle(mx + x, my + y, 4.6 * lit, 8), fill: [0.93, 0.9, 0.82, 0.9], z: ZFAR });
  }
  out.push({ shape: rect(-800, 560, 3520, 900), fill: lin(0, 560, 0, 900, [0, "#081020"], [1, "#020307"]), z: ZFAR });
  for (let i = 0; i < 60; i++) { const x = -700 + r() * 3300, y = 570 + r() * 160; out.push({ shape: rect(x, y, 30 + r() * 90, 2, 1), fill: [0.5, 0.6, 0.75, 0.15 + 0.25 * r() * (0.6 + 0.4 * Math.sin(t * 1.3 + i))], z: ZFAR }); }
  // The coast's other lit buildings: one warm point per lesson on the Lantern Coast.
  for (let i = 0; i < 9; i++) out.push({ shape: circle(-300 + i * 330 + 40 * r(), 558 - 10 * r(), 3, 8), fill: [1, 0.75, 0.4, 0.8], blend: "add", z: ZFAR });
  return out;
}

// Glazing: mullions on a cylinder (spacing shrinks toward the sides), two rails, and the floor.
export function glazing() {
  const out = [];
  for (let k = -7; k <= 7; k++) {
    const a = (k / 7) * 1.25, x = 960 + Math.sin(a) * 1150, w = 6 + 12 * Math.cos(a);
    out.push({ shape: rect(x - w / 2, -300, w, 1240), fill: "#0c0a09", z: ZGLASS });
  }
  out.push({ shape: rect(-400, 120, 2720, 14), fill: "#0f0d0b", z: ZGLASS }, { shape: rect(-400, 840, 2720, 20), fill: "#0f0d0b", z: ZGLASS });
  out.push({ shape: rect(-400, 860, 2720, 400), fill: lin(0, 860, 0, 1100, [0, "#1b1511"], [1, "#070605"]) });
  for (let k = 0; k < 14; k++) out.push({ shape: rect(-400, 880 + k * k * 1.6, 2720, 2), fill: [0, 0, 0, 0.35] });
  return out;
}

// The Fresnel lens: brass frame and pedestal, concentric glass rings, one bright bar that turns
// (angle a), and the lamp at the centre. open (0..1) dims the rings as the aperture opens.
export function lens(t, { a = t * 1.3, open = 0, lamp = 1, iris = 1, at = LENS } = {}) {
  const { x, y, r } = at, out = [];
  out.push({ shape: polyline([x - 60, y + r - 10, x + 60, y + r - 10, x + 90, 940, x - 90, 940], true), fill: lin(x - 90, 0, x + 90, 0, [0, "#2a2016"], [0.5, "#4a3a22"], [1, "#1a140e"]), stroke: "#0b0a0c", width: 4 });
  out.push({ shape: circle(x, y, r * iris, 96), fill: "#3a2c18", stroke: "#0b0a0c", width: 6 });
  for (let k = 0; k < 10; k++) { const rr = (r - 18 - k * 21) * iris; if (rr > 4) out.push({ shape: circle(x, y, rr, 96), fill: null, stroke: [0.85, 0.8, 0.65, (0.16 + 0.04 * k) * (1 - open)], width: 5 }); }
  for (let k = 0; k < 12; k++) { const b = (k / 12) * Math.PI * 2; out.push({ shape: circle(x + Math.cos(b) * (r - 8) * iris, y + Math.sin(b) * (r - 8) * iris, 4, 8), fill: "#b8892e" }); }
  for (const da of [0, Math.PI]) out.push({ shape: polyline([x, y, x + Math.cos(a + da) * r * iris, y + Math.sin(a + da) * r * iris, x + Math.cos(a + da + 0.22) * r * iris, y + Math.sin(a + da + 0.22) * r * iris], true), blend: "add", fill: [1, 0.85, 0.55, 0.22 * lamp] });
  if (lamp > 0) out.push({ shape: circle(x, y, 46 * iris, 48), blend: "add", fill: rad(x, y, 46 * iris, [0, [1, 0.96, 0.82, lamp]], [1, [1, 0.7, 0.3, 0]]) });
  return out;
}

// A word card pinned to the glass. lit (0..1) is the light pool on it; blank draws an empty frame.
export function card(A, w, p, { lit = 0, blank = false, arrive = 1, hot = false, size = null } = {}) {
  const W = p.w || 184, H = Math.round(W * 0.6), fs = size || Math.min(38, Math.max(16, W / 4.4)), dy = (1 - arrive) * -260, x = p.x, y = p.y + dy, op = smooth01(arrive * 1.6);
  if (op <= 0) return [];
  const out = [{ shape: rect(x - W / 2 + 8, y - H / 2 + 10, W, H, 3), fill: [0, 0, 0, 0.5 * op], blur: 8, z: p.z }];
  out.push(blank ? { shape: rect(x - W / 2, y - H / 2, W, H, 3), fill: [0.1, 0.09, 0.08, 0.6 * op], stroke: [0.9, 0.85, 0.7, 0.7 * op], width: 3, dash: [12, 8], z: p.z }
    : { shape: rect(x - W / 2, y - H / 2, W, H, 3), fill: lin(x, y - H / 2, x, y + H / 2, [0, "#e3d6b5"], [1, "#b9a985"]), stroke: hot ? C.hot : "#2a2219", width: hot ? 5 : 3, opacity: op, z: p.z });
  out.push({ shape: circle(x, y - H / 2 + 6, 6, 16), fill: "#7a2620", opacity: op, z: p.z });
  if (!blank) out.push({ shape: words(w, A.sans, fs, x, y + fs * 0.34, "center"), fill: "#1d1812", opacity: op, z: p.z });
  if (lit > 0.01) out.push({ shape: circle(x, y, W * 0.85, 64), blend: "add", fill: rad(x, y, W * 0.85, [0, [1, 0.72, 0.38, 0.85 * lit]], [1, [1, 0.6, 0.3, 0]]), z: p.z });
  return out;
}

// A soft beam from the lens to a point, strength k.
export function beam(px, py, k, { from = LENS, half = 90, z = ZCARD } = {}) {
  const dx = px - from.x, dy = py - from.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  return { shape: polyline([from.x + nx * 26, from.y + ny * 26, px + nx * half, py + ny * half, px - nx * half, py - ny * half, from.x - nx * 26, from.y - ny * 26], true),
    blend: "add", fill: lin(from.x, from.y, px, py, [0, [1, 0.8, 0.5, 0.5 * k]], [1, [1, 0.65, 0.3, 0.12 * k]]), z };
}

// Tallow, posed by options o (tallow.mjs), at his mark or another; z brings him toward the camera.
export function tallow(o, at = TALLOW) {
  const g = GUIDES.tallow;
  const z = at.z ?? 0;
  return [...g.under(at.x, at.y, at.s, "thriller"), ...pose(g.parts(o), { x: at.x, y: at.y, s: at.s, shear: g.shear })].map((it) => (z ? { ...it, z } : it));
}
export const Z = { FAR: ZFAR, GLASS: ZGLASS, CARD: ZCARD, NEAR: ZNEAR };
export const segPath = (pts) => [contour(pts, false)];
