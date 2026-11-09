// Visual-direction proofs for lesson F1 (vectors), one beat drawn four ways. Two crates on Pylon's
// chart are two vectors from the chart's corner; the second swings round, and the dot product and
// the cosine of the angle between them are computed live from the drawn coordinates. ?dir= picks
// A (painted isometric harbour), B (data art, the attention film's look), C (a printed chart from
// above, light gouache), D (the same chart in the pixel look) or E (the chart printed, no paint).
import { rect, circle, polyline } from "../../../raw-native/tree-ada041f/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-ada041f/web/motion/text.mjs";
import { rng } from "../../../raw-native/tree-ada041f/web/motion/timeline.mjs";
import { pose, lin, rad } from "../../../raw-native/tree-ada041f/templates/guides/rig.mjs";
import { GUIDES } from "../../../raw-native/tree-ada041f/templates/guides/guides.mjs";
import { LOOKS } from "../../../raw-native/tree-ada041f/templates/guides/look.mjs";
import { loadHarbour, harbour, sortedThings, S } from "../../../raw-native/tree-ada041f/templates/guides/worlds/harbour.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "C";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const A_VEC = [4, 1.5];
// The second crate swings from near the first to a right angle and past it.
const bAt = (t) => { const a = 0.15 + 2.0 * sm(0.5, 5.5, t), r = 3.6; return [r * Math.cos(a), r * Math.sin(a)]; };
const dot = (u, v) => u[0] * v[0] + u[1] * v[1], len = (u) => Math.hypot(u[0], u[1]);
const T = (s, atlas, size, x, y, anchor = "left") => text(s, { atlas, size, x, y, anchor }).shape;

// Chart units to screen for the flat (top-down) directions: origin lower left, y up, 1 unit = U px.
const flat = (o, U) => ([x, y]) => [o[0] + x * U, o[1] - y * U];

function arrow(p0, p1, colour, w) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, h = 10 + 2.2 * w;
  return [{ shape: polyline([p0[0], p0[1], p1[0] - ux * h * 0.6, p1[1] - uy * h * 0.6]), fill: null, stroke: colour, width: w },
    { shape: polyline([p1[0], p1[1], p1[0] - ux * h - uy * h * 0.5, p1[1] - uy * h + ux * h * 0.5, p1[0] - ux * h + uy * h * 0.5, p1[1] - uy * h - ux * h * 0.5], true), fill: colour }];
}
function arc(P, a0, a1, rr, colour, w) {
  const pts = []; for (let k = 0; k <= 32; k++) { const a = a0 + (a1 - a0) * (k / 32); pts.push(...P([rr * Math.cos(a), rr * Math.sin(a)])); }
  return { shape: polyline(pts), fill: null, stroke: colour, width: w };
}
function readout(A, b, x, y, ink, dim, hot) {
  const d = dot(A_VEC, b), c = d / (len(A_VEC) * len(b)), f = (v) => v.toFixed(2);
  return [
    { shape: T(`a = (${f(A_VEC[0])}, ${f(A_VEC[1])})    b = (${f(b[0])}, ${f(b[1])})`, A.mono, 30, x, y), fill: dim, screen: true },
    { shape: T(`a . b = ${f(A_VEC[0])} x ${f(b[0])} + ${f(A_VEC[1])} x ${f(b[1])} = ${f(d)}`, A.mono, 34, x, y + 50), fill: ink, screen: true },
    { shape: T(`cosine = ${f(c)}`, A.mono, 46, x, y + 112), fill: Math.abs(c) < 0.05 ? hot : ink, screen: true },
  ];
}
const pylonAt = (x, y, s, t, extra = {}) => pose(GUIDES.pylon.parts({ look: [6, -2], bark: 0.25 * sm(5.2, 5.6, t), ...extra }), { x, y, s, shear: GUIDES.pylon.shear || 0 });

// C and D: a printed chart seen from above, on Pylon's desk.
function chart(t, A, pixel) {
  const P = flat([560, 860], 150), items = [], r = rng(5);
  items.push({ shape: rect(0, 0, 1920, 1080), fill: rad(960, 520, 1200, [0, "#2a2018"], [1, "#0b0806"]) });
  items.push({ shape: rect(330, 120, 1260, 860, 6), fill: lin(330, 120, 1590, 980, [0, "#e3d6b4"], [1, "#c9b78f"]), stroke: "#3a2c1c", width: 4 });
  // A coastline in fine line-work and depth soundings, as on a real chart.
  for (let k = 0; k < 6; k++) { const pts = []; for (let x = 340; x <= 1580; x += 20) pts.push(x, 200 + k * 16 + 30 * Math.sin(x / 140 + k) + 10 * Math.sin(x / 37)); items.push({ shape: polyline(pts), fill: null, stroke: [0.25, 0.32, 0.4, 0.35 - 0.04 * k], width: 1.5 }); }
  for (let k = 0; k < 40; k++) items.push({ shape: T(String(2 + Math.floor(r() * 30)), A.mono, 14, 360 + r() * 1200, 300 + r() * 640), fill: [0.3, 0.35, 0.42, 0.45] });
  // The grid, the two axes and their ticks.
  for (let i = -1; i <= 6; i++) { const [x] = P([i, 0]); items.push({ shape: polyline([x, 140, x, 960]), fill: null, stroke: [0.35, 0.3, 0.22, 0.35], width: 1.5 }); }
  for (let j = -1; j <= 4; j++) { const [, y] = P([0, j]); items.push({ shape: polyline([350, y, 1570, y]), fill: null, stroke: [0.35, 0.3, 0.22, 0.35], width: 1.5 }); }
  items.push({ shape: polyline([...P([-1, 0]), ...P([6.8, 0])]), fill: null, stroke: "#2a2015", width: 3 }, { shape: polyline([...P([0, -0.6]), ...P([0, 4.6])]), fill: null, stroke: "#2a2015", width: 3 });
  const b = bAt(t), a = A_VEC, aA = Math.atan2(a[1], a[0]), aB = Math.atan2(b[1], b[0]);
  items.push(arc(P, aA, aB, 1.1, "#8a3b22", 4));
  items.push(...arrow(P([0, 0]), P(a), "#1d1812", 6), ...arrow(P([0, 0]), P(b), "#a5452a", 6));
  for (const v of [a, b]) { const [x, y] = P(v); items.push({ shape: rect(x - 26, y - 26, 52, 52, 3), fill: "#8e6c47", stroke: "#2a1f15", width: 3 }, { shape: polyline([x - 26, y - 26, x + 26, y + 26]), fill: null, stroke: "#5c4630", width: 2 }); }
  items.push(...pylonAt(1700, 1000, pixel ? 0.5 : 0.55, t, { look: [-8, -4] }));
  const hud = readout(A, b, 380, 140, "#efe6cf", "#b29d7e", "#e29472");
  hud.unshift({ shape: rect(360, 98, 900, 190, 10), fill: [0.05, 0.04, 0.03, 0.82], screen: true });
  hud.push({ shape: T("a", A.sans, 34, ...P([a[0] + 0.25, a[1] - 0.05])), fill: "#1d1812", screen: true }, { shape: T("b", A.sans, 34, ...P([b[0] + 0.2, b[1] + 0.2])), fill: "#a5452a", screen: true });
  return { items, hud };
}

// A: the harbour in its painted isometric world; the chart is chalked on the quay.
function quay(t, A, W) {
  const o = [4, 9], G = (v) => S(o[0] + v[0], o[1] - v[1], 0.02), b = bAt(t), a = A_VEC;
  const chalk = [];
  for (let i = 0; i <= 5; i++) chalk.push({ shape: polyline([...G([i, 0]), ...G([i, 4])]), fill: null, stroke: [0.9, 0.9, 0.85, 0.18], width: 2 });
  for (let j = 0; j <= 4; j++) chalk.push({ shape: polyline([...G([0, j]), ...G([5, j])]), fill: null, stroke: [0.9, 0.9, 0.85, 0.18], width: 2 });
  chalk.push(...arrow(G([0, 0]), G(a), "#f1e4c8", 6), ...arrow(G([0, 0]), G(b), "#e29472", 6));
  const H = harbour(W, [{ d: 1e9, items: pylonAt(...S(o[0] - 0.6, o[1] + 0.6), 0.5, t) }]);
  const items = [...H.back, ...chalk, ...sortedThings(H.things), ...H.front];
  const hud = readout(A, b, 80, 120, "#f1e4c8", "#b29d7e", "#e29472");
  hud.unshift({ shape: rect(60, 70, 900, 190, 10), fill: [0.03, 0.03, 0.05, 0.8], screen: true });
  return { items, hud, camera: { x: 1000, y: 560, zoom: 0.9 } };
}

// B: data art in the attention film's look: the chart as fine line-work, the arrows as bundles of
// threads.
function data(t, A) {
  const P = flat([660, 820], 150), items = [], r = rng(3), b = bAt(t), a = A_VEC;
  for (let k = 0; k < 900; k++) { const x = 300 + r() * 1400, y = 120 + r() * 860; items.push({ shape: circle(x, y, 1.2, 6), fill: [0.8, 0.85, 1, 0.08 + 0.1 * r()], blend: "add" }); }
  for (let i = -2; i <= 6; i++) { const [x] = P([i, 0]); items.push({ shape: polyline([x, 120, x, 980]), fill: null, stroke: [0.6, 0.7, 0.85, 0.12], width: 1 }); }
  for (let j = -1; j <= 5; j++) { const [, y] = P([0, j]); items.push({ shape: polyline([300, y, 1700, y]), fill: null, stroke: [0.6, 0.7, 0.85, 0.12], width: 1 }); }
  const bundle = (v, c, seed) => { const q = rng(seed), out = []; for (let k = 0; k < 160; k++) { const e = [v[0] + (q() - 0.5) * 0.08, v[1] + (q() - 0.5) * 0.08], m = [v[0] / 2 + (q() - 0.5) * 0.3, v[1] / 2 + (q() - 0.5) * 0.3]; out.push({ shape: polyline([...P([0, 0]), ...P(m), ...P(e)]), fill: null, stroke: [...c, 0.12], width: 1, blend: "add" }); } return out; };
  items.push(...bundle(a, [0.93, 0.9, 0.84], 1), ...bundle(b, [0.89, 0.58, 0.45], 2));
  items.push(arc(P, Math.atan2(a[1], a[0]), Math.atan2(b[1], b[0]), 1.0, [0.89, 0.58, 0.45, 0.8], 2));
  for (const [v, c] of [[a, [0.93, 0.9, 0.84, 1]], [b, [0.89, 0.58, 0.45, 1]]]) items.push({ shape: circle(...P(v), 12, 16), fill: c, blend: "add" });
  items.push(...pylonAt(1660, 990, 0.42, t, { look: [-8, -4] }));
  const hud = readout(A, b, 80, 90, "#ece5d6", "#958e80", "#e29472");
  return { items, hud };
}

export default {
  title: `Vectors proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    const W = DIR === "A" ? { ...(await loadHarbour()), atlas: sans } : null;
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, W };
  },
  // The engine has no separate label layer, so labels are screen items and pass through the look.
  frame(t, ctx) {
    const A = ctx.assets, cam = { x: 960, y: 540, zoom: 1 };
    if (DIR === "A") { const f = quay(t, A, A.W); return { background: LOOKS.painted.ground, camera: f.camera, items: [...f.items, ...f.hud], post: LOOKS.painted.post }; }
    if (DIR === "B") { const f = data(t, A); return { background: [0, 0, 0], camera: cam, items: [...f.items, ...f.hud], post: { bloom: 0.3, threshold: 1.0, vignette: 0.3, grain: 0.05, passes: [] } }; }
    const f = chart(t, A, DIR === "D"), items = [...f.items, ...f.hud];
    if (DIR === "D") return { background: LOOKS.pixel.ground, camera: cam, items, post: LOOKS.pixel.post, pixel: { width: 480, height: 270, mode: "integer" } };
    // C: a light gouache over the printed chart; E: the print as it is, with grain and a lamp's falloff.
    if (DIR === "C") return { background: [0.02, 0.02, 0.02], camera: cam, items, post: { bloom: 0.06, threshold: 1.0, vignette: 0.3, grain: 0, passes: [{ pass: "paint", preset: "gouache", radius: 3 }] } };
    return { background: [0.02, 0.02, 0.02], camera: cam, items, post: { bloom: 0.12, threshold: 1.0, vignette: 0.4, grain: 0.06, passes: [] } };
  },
};
