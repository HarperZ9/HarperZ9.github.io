// Segment 6, second half: the three pieces the script's segment 7 waited on, which landed before
// this scene was written. Models: the ten glTF models by name, each ticked verified. Retro: the
// box drawn by the rule the check holds to (vertex positions snapped to a grid, then texture
// coordinates spread across each triangle in screen space), so it wobbles and its checker swims
// as the camera turns. Lit: the box under three coloured lights, with the cluster grid that
// assigns lights to cells drawn over the view. The retro and lit drawings are depictions; the
// numbers are the checks'.
import { contour, rect } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { C, box, view, inFacet, put, T, tab, tag, fact, span, window, ease } from "./world.mjs";

const FACES = [[[0, 1, 0], [[-1, 2, -1], [1, 2, -1], [1, 2, 1], [-1, 2, 1]]], [[0, 0, 1], [[-1, 0, 1], [1, 0, 1], [1, 2, 1], [-1, 2, 1]]],
  [[1, 0, 0], [[1, 0, 1], [1, 0, -1], [1, 2, -1], [1, 2, 1]]], [[-1, 0, 0], [[-1, 0, -1], [-1, 0, 1], [-1, 2, 1], [-1, 2, -1]]], [[0, 0, -1], [[1, 0, -1], [-1, 0, -1], [-1, 2, -1], [1, 2, -1]]]];

// The retro box: each face's corners projected and snapped, then an 8 x 8 checker laid on its two
// triangles by screen-space (affine) interpolation.
function retroBox(v, snap = 16, n = 8) {
  const out = [...box(v, { floorGrid: true, shadow: false, edges: null }).slice(0, 1)];
  for (const [nrm, q] of FACES) {
    const c = q.reduce((a, p) => a.map((x, i) => x + p[i] / 4), [0, 0, 0]), e = v.eye.map((x, i) => x - c[i]);
    if (e[0] * nrm[0] + e[1] * nrm[1] + e[2] * nrm[2] <= 0) continue;
    const s = q.map((p) => v.proj(p).map((k) => Math.floor(k / snap + 0.5) * snap));
    const at = (u, w) => (u + w <= 1 ? [0, 1].map((k) => s[0][k] + (s[1][k] - s[0][k]) * u + (s[3][k] - s[0][k]) * w)
      : [0, 1].map((k) => s[2][k] + (s[3][k] - s[2][k]) * (1 - u) + (s[1][k] - s[2][k]) * (1 - w)));
    const lum = 0.3 + 0.6 * Math.max(0, 0.7 * nrm[1] - 0.5 * nrm[0] + 0.3 * nrm[2] + 0.3);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const u0 = i / n, u1 = (i + 1) / n, w0 = j / n, w1 = (j + 1) / n, dark = (i + j) % 2;
      out.push({ shape: [contour([...at(u0, w0), ...at(u1, w0), ...at(u1, w1), ...at(u0, w1)], true)], fill: dark ? [0.25 * lum, 0.18 * lum, 0.5 * lum] : [0.9 * lum, 0.75 * lum, 0.45 * lum] });
    }
  }
  return out;
}

const LIGHTS = [[[1, 0.45, 0.25], 0], [[0.3, 0.6, 1], 2.1], [[0.5, 1, 0.5], 4.2]];

// The lit box: each face lit by three point lights circling it; the lights as small glows.
function litBox(v, t) {
  const pos = LIGHTS.map(([col, ph]) => [col, [3.2 * Math.cos(t * 0.6 + ph), 2.6 + 0.6 * Math.sin(t + ph), 3.2 * Math.sin(t * 0.6 + ph)]]);
  const items = box(v, { faceColour: (n, l) => {
    const c = [0.05, 0.05, 0.06];
    for (const [col, p] of pos) { const d = p.map((x, i) => x - n[i]), L = Math.hypot(...d), k = Math.max(0, (d[0] * n[0] + d[1] * n[1] + d[2] * n[2]) / L) * 5 / (L * L); for (let i = 0; i < 3; i++) c[i] += col[i] * k; }
    return c.map((x) => Math.min(1, x));
  } });
  for (const [col, p] of pos) { const [x, y] = v.proj(p); items.push({ shape: rect(x - 9, y - 9, 18, 18, 9), fill: col }, { shape: rect(x - 34, y - 34, 68, 68, 34), fill: col, opacity: 0.25, blur: 16 }); }
  // The cluster grid: the view split into tiles, each tile a list of the lights that reach it.
  for (let x = 160; x <= 1760; x += 160) items.push({ shape: [contour([x, 160, x, 940], false)], stroke: C.ink, width: 1, opacity: 0.25 });
  for (let y = 160; y <= 940; y += 130) items.push({ shape: [contour([160, y, 1760, y], false)], stroke: C.ink, width: 1, opacity: 0.25 });
  return items;
}

export function prepare(A, facts, c) {
  const ev = A.ev;
  A.s6b = {
    names: ev.models.map((m, i) => T(A, m, { size: 28, x: 470 + (i % 5) * 245, y: 440 + Math.floor(i / 5) * 210, atlas: "sans" })),
    cards: ev.models.map((m, i) => rect(470 + (i % 5) * 245 - 116, 440 + Math.floor(i / 5) * 210 - 80, 232, 150, 10)),
    ticks: ev.models.map((m, i) => { const x = 470 + (i % 5) * 245, y = 440 + Math.floor(i / 5) * 210 + 40; return [contour([x - 18, y, x - 4, y + 14, x + 22, y - 14], false)]; }),
    models: T(A, `${fact(ev, "gltf_models")} glTF models . ${fact(ev, "gltf_verified")} of ${fact(ev, "gltf_models")} verified`, { size: 36, x: 960, y: 262, atlas: "mono" }),
    retro: T(A, `${fact(ev, "retro_cases")} cases . ${fact(ev, "retro_cover")} coverage mismatches`, { size: 36, x: 960, y: 262, atlas: "mono" }),
    lit: T(A, `${fact(ev, "light_points")} points . ${fact(ev, "light_missed")} missed`, { size: 36, x: 960, y: 262, atlas: "mono" }),
    rule: tag(A, "drawn by the rule the check holds to"), grid: tag(A, "the cluster grid, drawn"),
    tabs: { models: tab(A, ev, "rn-pr73"), retro: tab(A, ev, "rn-pr74"), lit: tab(A, ev, "rn-m3") },
  };
  A.T6b = { models: c.at(6, 4, 0), verified: c.word(6, 4, 0, "verified"), retro: c.at(6, 5, 0), cases: c.word(6, 5, 0, "12 cases"),
    lit: c.at(6, 6, 0), points: c.at(6, 6, 1), exit: c.at(7, 0, 0) };
}
export const stops = (c) => [["models", c.at(6, 4, 0)], ["retro", c.at(6, 5, 0)], ["lit", c.at(6, 6, 0)]];

export function draw(t, A, items) {
  const S = A.s6b, T = A.T6b;
  if (t < T.models - 3 || t > T.exit + 1) return;
  const M = [];
  S.cards.forEach((r, i) => {
    const o = span(t, T.models + 1.2 + i * 0.12, T.models + 1.8 + i * 0.12);
    M.push({ shape: r, fill: [0.06, 0.06, 0.07], opacity: 0.4 + 0.6 * o }, { shape: r, stroke: C.ink2, width: 2, opacity: 0.4 + 0.6 * o }, { shape: S.names[i], fill: C.ink, opacity: 0.25 + 0.75 * o });
    M.push({ shape: S.ticks[i], stroke: C.ok, width: 6, cap: "round", join: "round", opacity: span(t, T.verified + i * 0.08, T.verified + 0.4 + i * 0.08) });
  });
  const yaw = 24 + (t - T.retro) * 6;
  items.push(...inFacet(M, "models"), ...inFacet(retroBox(view({ yaw, pitch: 22, dist: 9.5 })), "retro"),
    ...inFacet(litBox(view({ yaw: 34, pitch: 24, dist: 9.5 }), t), "lit"));
  const w = (a, b) => window(t, a, b, 0.5, 0.5);
  put(items, S.models, C.ink, w(T.verified, T.retro - 0.6));
  put(items, S.tabs.models, C.ink2, 0.85 * w(T.models + 1.2, T.retro - 0.6));
  put(items, S.retro, C.ink, w(T.cases, T.lit - 0.6));
  put(items, S.tabs.retro, C.ink2, 0.85 * w(T.retro + 1.4, T.lit - 0.6));
  put(items, S.rule, C.hot, w(T.retro + 1.4, T.lit - 0.6));
  put(items, S.lit, C.ink, w(T.points, T.exit - 0.2));
  put(items, S.tabs.lit, C.ink2, 0.85 * w(T.lit + 1.4, T.exit - 0.2));
  put(items, S.grid, C.hot, w(T.lit + 1.4, T.exit - 0.2));
}
