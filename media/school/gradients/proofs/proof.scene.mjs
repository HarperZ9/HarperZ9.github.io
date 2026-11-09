// Visual-direction proofs for lesson F3 (gradients): one beat, gradient descent on the tilted bowl
// (curvatures 4 and 0.5, turned 30 degrees) at a safe step and at 1.2 times the edge, two ways:
// ?dir=A, a printed contour map on Pylon's desk (true slopes, the pair 1 chart look), or ?dir=B,
// the surface as line-work relief in fog, seen from the side, with the paths riding on it.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";
import { K, desk, pylon } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
// f(p) = 0.5 (4 u^2 + 0.5 v^2) with (u, v) the bowl's own axes.
const uv = ([x, y]) => [c * x + s * y, -s * x + c * y];
const f = (p) => { const [u, v] = uv(p); return 0.5 * (4 * u * u + 0.5 * v * v); };
const grad = (p) => { const [u, v] = uv(p), gu = 4 * u, gv = 0.5 * v; return [c * gu - s * gv, s * gu + c * gv]; };
const run = (step, n, p0 = [-2, 2]) => { const out = [p0]; let p = p0; for (let i = 0; i < n; i++) { const g = grad(p); p = [p[0] - step * g[0], p[1] - step * g[1]]; out.push(p); } return out; };
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

export default {
  title: `Gradients proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, safe = run(0.25, 14), wild = run(0.6, 4), k = Math.floor(sm(0.3, 5.5, t) * 14), items = [];
    if (DIR === "A") {
      const P = ([x, y]) => [960 + x * 190, 540 - y * 190];
      items.push(...desk(t), { shape: rect(330, 110, 1260, 880, 6), fill: [0.9, 0.85, 0.71, 1], stroke: "#3a2c1c", width: 4 });
      for (let lv = 1; lv <= 14; lv++) {
        const L = 0.12 * lv * lv, pts = [];
        for (let a = 0; a <= 64; a++) { const th = (a / 64) * Math.PI * 2, u = Math.sqrt(2 * L / 4) * Math.cos(th), v = Math.sqrt(2 * L / 0.5) * Math.sin(th); pts.push(...P([c * u - s * v, s * u + c * v])); }
        items.push({ shape: polyline(pts, true), fill: null, stroke: [0.42, 0.3, 0.18, lv % 5 === 0 ? 0.7 : 0.35], width: lv % 5 === 0 ? 2.5 : 1.5 });
      }
      const path = (pp, col, n) => [{ shape: polyline(pp.slice(0, n + 1).flatMap(P)), fill: null, stroke: col, width: 4 }, ...pp.slice(0, n + 1).map((p) => ({ shape: circle(...P(p), 7, 12), fill: col }))];
      items.push(...path(safe, K.ink, k), ...path(wild, K.rust, Math.min(4, k)));
      items.push({ shape: words(`step 0.25 (half the edge): loss ${f(safe[k]).toFixed(3)}`, A.mono, 30, 380, 160), fill: K.ink }, { shape: words(`step 0.60 (1.2 x the edge): loss ${f(wild[Math.min(4, k)]).toFixed(1)}`, A.mono, 30, 380, 205), fill: K.rust });
      items.push(...pylon(t, 1745, 1015, 0.52));
      return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.12, threshold: 1, vignette: 0.4, grain: 0.06, passes: [] } };
    }
    // B: relief. Oblique view: x across, y into the screen, height up; fog by depth.
    const yaw = -0.5 + 0.25 * Math.sin(t * 0.4), P = ([x, y], z) => { const xr = Math.cos(yaw) * x - Math.sin(yaw) * y, yr = Math.sin(yaw) * x + Math.cos(yaw) * y; return [960 + xr * 230, 650 + yr * 70 - Math.min(z, 9) * 52]; };
    const fog = (y) => 0.15 + 0.7 * Math.max(0, Math.min(1, (y + 3) / 6));
    items.push({ shape: rect(0, 0, 1920, 1080), fill: [0.02, 0.025, 0.035, 1], screen: true });
    for (let gy = -3; gy <= 3.001; gy += 0.25) { const pts = []; for (let gx = -3; gx <= 3.001; gx += 0.1) pts.push(...P([gx, gy], f([gx, gy]))); items.push({ shape: polyline(pts), fill: null, stroke: [0.75, 0.82, 0.95, 0.35 * fog(-gy)], width: 1.2, blend: "add" }); }
    for (let gx = -3; gx <= 3.001; gx += 0.5) { const pts = []; for (let gy = -3; gy <= 3.001; gy += 0.1) pts.push(...P([gx, gy], f([gx, gy]))); items.push({ shape: polyline(pts), fill: null, stroke: [0.75, 0.82, 0.95, 0.12], width: 1, blend: "add" }); }
    const ride = (pp, col, n) => [{ shape: polyline(pp.slice(0, n + 1).flatMap((p) => P(p, f(p)))), fill: null, stroke: col, width: 3, blend: "add" }, ...pp.slice(0, n + 1).map((p) => ({ shape: circle(...P(p, f(p)), 7, 12), fill: col, blend: "add" }))];
    items.push(...ride(safe, [0.93, 0.9, 0.84, 1], k), ...ride(wild, [0.89, 0.58, 0.45, 1], Math.min(4, k)));
    items.push({ shape: words(`step 0.25: loss ${f(safe[k]).toFixed(3)}    step 0.60: loss ${f(wild[Math.min(4, k)]).toFixed(1)}`, A.mono, 30, 80, 80), fill: "#ece5d6", screen: true });
    items.push(...pylon(t, 1745, 1015, 0.45));
    return { background: [0, 0, 0], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.3, threshold: 1, vignette: 0.3, grain: 0.05, passes: [] } };
  },
};
