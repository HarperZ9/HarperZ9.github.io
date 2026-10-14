// Segment 5, "Film, simulated as film". A cross-section of the negative: light enters, the blue,
// green and red layers take it in turn, the base sits under them. Then the box goes through the
// engine's film pass (exposure, development, print, projection). For the red halo the base is
// drawn: a ray reflects at the critical angle and comes back up 2 t tan(theta_c) away, the
// ring's radius, while the pass switches to the stock without its anti-halation layer. The
// constants are flagged as the shader library flags them.
import { contour, rect } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { C, box, view, inFacet, put, T, tab, tag, fact, span, window, ease, lerp, FACET } from "./world.mjs";

const LAYERS = [["blue", [0.35, 0.5, 1]], ["green", [0.35, 0.9, 0.45]], ["red", [1, 0.35, 0.3]]];

function section(A) {
  const items = [], x0 = 360, x1 = 1560;
  LAYERS.forEach(([, col], k) => items.push({ shape: rect(x0, 300 + k * 70, x1 - x0, 62), fill: col.map((v) => v * 0.35) }, { shape: rect(x0, 300 + k * 70, x1 - x0, 62), stroke: col, width: 2 }));
  items.push({ shape: rect(x0, 520, x1 - x0, 150), fill: [0.12, 0.11, 0.1] }, { shape: rect(x0, 520, x1 - x0, 150), stroke: C.ink2, width: 2 });
  return items;
}

// The halation geometry over the base: a ray down to the back surface at the critical angle,
// reflected back up, landing 2 t tan(theta_c) from where it entered.
function bounce(u) {
  const xa = 760, ya = 520, yb = 670, dx = 260, pts = [xa, ya, xa + dx * Math.min(1, u * 2), lerp(ya, yb, Math.min(1, u * 2))];
  if (u > 0.5) pts.push(xa + dx + dx * (u - 0.5) * 2, lerp(yb, ya, (u - 0.5) * 2));
  return [contour(pts, false)];
}

export function prepare(A, facts, c) {
  const ev = A.ev;
  A.s5 = {
    section: section(A), box: box(view({ yaw: 34, pitch: 22, dist: 9.5 }), { faceColour: (n, l) => (n[1] ? [1, 0.98, 0.92] : [l * 0.9, l * 0.86, l * 0.8]) }),
    layers: T(A, "blue . green . red layers", { size: 38, x: 960, y: 196 }),
    ring: T(A, `ring at 2t tan(theta_c) = ${fact(ev, "halation_mm")} mm`, { size: 38, x: 960, y: 196, atlas: "mono" }),
    grain: T(A, "grain: the Boolean model", { size: 38, x: 960, y: 196 }),
    parity: T(A, `${fact(ev, "film_cases")} film cases . GPU within ${fact(ev, "film_code")} step in 255`, { size: 34, x: 960, y: 262, atlas: "mono" }),
    low: tag(A, "most film and tube constants: low confidence"),
    tabS: tab(A, ev, "rn-shaders"), tabN: tab(A, ev, "newson2017"), tabP: tab(A, ev, "rn-film-parity"),
  };
  A.T5 = { enter: c.at(5, 0, 0), developed: c.word(5, 0, 0, "developed"), grain: c.at(5, 1, 0), halo: c.word(5, 1, 0, "red halo"),
    base: c.word(5, 1, 0, "film base"), exit: c.at(6, 0, 0) };
  A.T5.parity = Math.min(A.T5.exit - 2.6, c.end(5, 1, 0) - 0.4);
}
export const stops = (c) => [["film", c.at(5, 0, 0)]];

export function look(t, A, cam) {
  const T5 = A.T5, f = FACET.film;
  if (t < T5.developed || t > T5.exit + 1 || Math.hypot(cam.x - f.cx, cam.y - f.cy) > 1) return null;
  const preset = t < T5.halo ? "500t-print" : "500t-no-remjet";
  return { post: { passes: [{ pass: "film", preset, ev: 0.6 }], bloom: 0 }, since: t < T5.halo ? T5.developed : T5.halo };
}

export function draw(t, A, items) {
  const S = A.s5, T5 = A.T5;
  if (t < T5.enter - 2 || t > T5.exit + 1) return;
  const secA = 1 - span(t, T5.developed, T5.developed + 0.4), haloA = window(t, T5.halo, T5.parity, 0.4, 0.5);
  const content = [];
  if (secA > 0 || haloA > 0) {
    const o = Math.max(secA, haloA);
    for (const it of S.section) content.push({ ...it, opacity: (it.opacity ?? 1) * o });
    // Light entering: a few rays, each fading as its layer takes it.
    for (let i = 0; i < 6; i++) content.push({ shape: [contour([520 + i * 160, 180, 520 + i * 160, 300 + 70 * (i % 3) + 62], false)], stroke: C.ink, width: 3, opacity: o * secA * 0.8 });
    if (haloA > 0) content.push({ shape: bounce(span(t, T5.halo, T5.halo + 2.2, ease.linear)), stroke: [1, 0.4, 0.3], width: 5, opacity: haloA });
  }
  if (secA < 1 && haloA < 1) for (const it of S.box) content.push({ ...it, opacity: (it.opacity ?? 1) * (1 - Math.max(secA, haloA)) });
  items.push(...inFacet(content, "film"));
  const o = window(t, T5.enter, T5.exit + 0.3, 0.6, 0.8);
  put(items, S.layers, C.ink, o * window(t, T5.enter + 0.6, T5.developed, 0.5, 0.4));
  put(items, S.tabS, C.ink2, o * 0.85 * window(t, T5.enter + 0.6, T5.grain, 0.5, 0.4));
  put(items, S.grain, C.ink, o * window(t, T5.grain + 0.3, T5.halo, 0.5, 0.4));
  put(items, S.tabN, C.ink2, o * 0.85 * window(t, T5.grain, T5.halo, 0.5, 0.4));
  put(items, S.ring, C.ink, o * haloA * span(t, T5.base, T5.base + 0.5));
  put(items, S.tabS, C.ink2, o * 0.85 * haloA);
  put(items, S.low, C.hot, o * window(t, T5.halo, T5.exit, 0.5, 0.5));
  put(items, S.parity, C.ink, o * span(t, T5.parity, T5.parity + 0.6));
  put(items, S.tabP, C.ink2, o * 0.85 * span(t, T5.parity, T5.parity + 0.6));
}
