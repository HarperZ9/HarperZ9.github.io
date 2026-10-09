// "Checking the light": how raw-native checks its own ambient occlusion.
// Every number and both images come from facts.json, which the media tool
// reads from a render at the commit being released (docs/media/media.json),
// so the video cannot describe a different build from the one it ships with.
import { rect, contour } from "@raw-native/motion/path.mjs";
import { text, fmt } from "@raw-native/motion/text.mjs";
import { span, window, ease, lerp, rng } from "@raw-native/motion/timeline.mjs";
import { sayTimeline } from "@raw-native/motion/narration.mjs";

const C = { ink: "#ece5d6", ink2: "#b8b0a0", dim: "#958e80", frame: "#2a2830", ok: "#63d4ce", hot: "#e29472" };
const N = 64, GAP = 10.4;

const gray = (v) => { const g = Math.max(0, Math.min(1, v)); return [0.08 + 0.86 * g, 0.08 + 0.84 * g, 0.08 + 0.80 * g, 1]; };

export default {
  title: "Checking the light",
  duration: 60,
  fps: 30,
  params: [{ id: "tolerance", label: "tolerance", min: 0.04, max: 0.2, step: 0.005, value: 0.12, note: "your value; raw-native's default is shown first" }],
  chapters: [],
  async load(ctx) {
    const facts = await ctx.json("../facts.json"), F = facts.facts, v = (k) => F[k].value;
    const timing = await ctx.json("../timing.json").catch(() => null);
    const tol = Number(v("tolerance")), rmse = Number(v("rmse")), verdict = v("verdict");
    ctx.params.tolerance = Math.round(tol * 1000) / 1000;
    this.params[0].value = ctx.params.tolerance;
    const lines = [
      `raw-native ${v("version")} renders a scene, and then it checks its own lighting.`,
      "Ambient occlusion darkens the places light has trouble reaching: creases, corners and the ground under an object.",
      `The reference traces ${v("rt")} rays from every pixel. It is slow, and it is the standard to meet.`,
      `The fast method estimates the same thing from the depth buffer, with ${v("ss")} samples a pixel.`,
      `raw-native compares the two over ${fmt(Number(v("pixels")))} pixels. The error is ${rmse.toFixed(3)}, against a tolerance of ${tol.toFixed(2)}.`,
      `So the certificate says ${verdict}: on this scene, the fast method is not close enough.`,
      "The certificate is a file. Anyone can run the render again and check the same numbers.",
    ];
    if (verdict !== "refuted") lines[5] = `So the certificate says ${verdict}: on this scene, the fast method is close enough.`;
    const tl = sayTimeline(lines, { timing });
    this.duration = tl.duration;
    this.captions = () => tl.vtt();
    this.chapters = [{ t: 0, title: "The scene" }, { t: tl.at(2), title: "Two answers" }, { t: tl.at(4), title: "The comparison" }, { t: tl.at(6), title: "The certificate" }];
    this.params[0].window = [tl.at(4) - 1, tl.duration];
    const A = { F, tl, tol, rmse, verdict, commit: facts.commit || "", atlas: await ctx.json("atlas.json") };
    const rt = v("ao_rt").flat(), ss = v("ao_ss").flat(), r = rng(3);
    // Contrast: both maps are stretched by the reference's own range, so equal values stay equal.
    const lo = Math.min(...rt), hi = Math.max(...rt), norm = (x) => (x - lo) / Math.max(1e-6, hi - lo);
    A.diff = rt.map((x, i) => Math.abs(x - ss[i]));
    // Formations: a scattered cloud, the reference grid on the left, the estimate on the right, both in the middle.
    const grid = (cx) => { const p = new Float32Array(2 * N * N); for (let i = 0; i < N * N; i++) { p[2 * i] = cx + ((i % N) - (N - 1) / 2) * GAP; p[2 * i + 1] = 560 + (Math.floor(i / N) - (N - 1) / 2) * GAP; } return p; };
    // Each field gathers from a loose cloud on its own side of the frame.
    const cloudAt = (cx) => { const c = new Float32Array(2 * N * N); for (let i = 0; i < N * N; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 520; c[2 * i] = cx + Math.cos(a) * d; c[2 * i + 1] = 560 + Math.sin(a) * d * 0.75; } return c; };
    const cloud = cloudAt(960), cloudR = cloudAt(1360);
    const delay = Float32Array.from({ length: N * N }, (_, i) => ((i % N) + Math.floor(i / N)) / (2 * N));
    A.forms = [cloud, grid(960), grid(560), grid(1360), cloudR];
    A.colRT = rt.map((x) => gray(norm(x))); A.colSS = ss.map((x) => gray(norm(x)));
    // Two fields: the reference and the estimate. They sit side by side, then merge into the difference.
    if (ctx.motion) {
      A.rtSys = ctx.motion.particles({ count: N * N, formations: A.forms, colors: [A.colRT, A.colRT], delay, seed: 9 });
      A.ssSys = ctx.motion.particles({ count: N * N, formations: A.forms, colors: [A.colSS], delay, seed: 11 });
    }
    const T = (s, size, x, y, anchor = "center", atlas = A.atlas) => text(s, { atlas, size, x, y, anchor }).shape;
    A.L = {
      title: T("Checking the light", 72, 960, 520), sub: T(`raw-native ${v("version")}, at commit ${A.commit.slice(0, 7)}`, 28, 960, 580),
      rtL: T(`ray-traced reference: ${v("rt")} rays a pixel`, 28, 560, 930), ssL: T(`fast estimate: ${v("ss")} samples a pixel`, 28, 1360, 930),
      cells: T(`${N} x ${N} cells, each the mean of its pixels`, 22, 960, 966),
      cert: [`"claim": "${F.claim.value}",`, `"verdict": "${verdict}",`, `"rmse": ${rmse.toFixed(6)}, "tolerance": ${tol.toFixed(2)},`, `"pixels": ${v("pixels")}`]
        .map((s, k) => T(s, 26, 520, 420 + k * 44, "left")),
      verify: T("raw_native_cli verify out", 30, 520, 640, "left"),
    };
    this.lines = lines;
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, tl = A.tl, items = [], tol = ctx.params.tolerance;
    const put = (shape, color, o) => { if (o > 0) items.push({ shape, fill: color, opacity: o, screen: true }); };
    put(A.L.title, C.ink, window(t, 0.2, tl.at(1) - 0.2, 0.8, 0.8));
    put(A.L.sub, C.ink2, window(t, 0.5, tl.at(1) - 0.2, 0.8, 0.8));
    // The particle field: cloud -> reference (centre) -> split left and right -> together as the difference.
    if (A.rtSys) {
      const k2 = tl.at(2), k3 = tl.at(3), k4 = tl.at(4), k6 = tl.at(6);
      const dimEnd = 1 - 0.75 * span(t, k6 - 0.4, k6 + 0.8);
      // The reference: gathers from a cloud, moves left, comes back to the middle as the difference.
      let rt;
      if (t < k2) rt = { from: 0, to: 1, t: span(t, tl.at(1) - 0.5, k2 - 0.2, ease.linear), spread: 0.6 };
      else if (t < k4) rt = { from: 1, to: 2, t: span(t, k2, k2 + 1.6, ease.inOut), spread: 0.2 };
      else rt = { from: 2, to: 1, t: span(t, k4, k4 + 1.6, ease.inOut), spread: 0.2, colorFrom: 0, colorTo: 1 };
      // Each cell of the difference: hot where the two answers differ by more than the tolerance.
      if (t >= k4) {
        const key = tol.toFixed(4);
        if (A.diffKey !== key) { A.rtSys.setColors(1, A.diff.map((d) => (d > tol ? C.hot : gray(0.1 + d * 3)))); A.diffKey = key; }
      }
      items.push({ kind: "particles", system: A.rtSys, colorFrom: 0, colorTo: 0, ...rt, drift: t < k2 ? 4 : 0, time: t, size: [8.4, 8.4], blend: "over", opacity: dimEnd });
      // The estimate: gathers on the right, then slides into the middle and gives way.
      if (t >= k3 - 0.2) {
        const ss = t < k4 ? { from: 4, to: 3, t: span(t, k3 - 0.2, k3 + 1.8, ease.linear), spread: 0.6 } : { from: 3, to: 1, t: span(t, k4, k4 + 1.6, ease.inOut), spread: 0.2 };
        items.push({ kind: "particles", system: A.ssSys, ...ss, colorFrom: 0, colorTo: 0, drift: 0, time: t, size: [8.4, 8.4], blend: "over",
          opacity: dimEnd * (1 - span(t, k4 + 0.9, k4 + 1.7)) });
      }
    }
    put(A.L.rtL, C.ink2, window(t, tl.at(2) + 0.3, tl.at(4), 0.5, 0.5));
    put(A.L.ssL, C.ink2, window(t, tl.at(3) + 0.6, tl.at(4), 0.5, 0.5));
    put(A.L.cells, C.dim, window(t, tl.at(2) + 0.3, tl.at(6), 0.5, 0.5));
    // The comparison: two bars, error and tolerance, and the verdict they give.
    const cmp = window(t, tl.at(4) + 0.8, tl.at(6), 0.6, 0.6);
    if (cmp > 0) {
      const x0 = 1340, w = 420 / 0.2, y = 450;
      const bar = (val, yy, col, label) => {
        items.push({ shape: rect(x0, yy, Math.max(2, val * w * span(t, tl.at(4) + 0.8, tl.at(4) + 2.2, ease.out)), 22, 3), fill: col, opacity: cmp, screen: true });
        put(text(label, { atlas: A.atlas, size: 26, x: x0, y: yy - 12 }).shape, C.ink2, cmp);
      };
      bar(A.rmse, y, C.ink, `error (rmse): ${A.rmse.toFixed(3)}`);
      bar(tol, y + 90, C.dim, `tolerance: ${tol.toFixed(3)}`);
      const pass = A.rmse <= tol;
      const verdict = Math.abs(tol - A.tol) < 1e-9 ? A.verdict : pass ? "verified" : "refuted";
      put(text(verdict, { atlas: A.atlas, size: 56, x: x0, y: y + 210 }).shape, pass ? C.ok : C.hot, cmp * span(t, tl.at(5), tl.at(5) + 0.6));
      const hot = A.diff.filter((d) => d > tol).length;
      put(text(`${fmt(hot)} of ${fmt(N * N)} cells differ by more than the tolerance`, { atlas: A.atlas, size: 22, x: x0, y: y + 260 }).shape, C.dim, cmp);
    }
    // The certificate, as the file says it.
    const ce = window(t, tl.at(6) - 0.2, tl.duration, 0.6, 1.0);
    if (ce > 0) {
      A.L.cert.forEach((s, k) => put(s, k === 1 ? (A.verdict === "verified" ? C.ok : C.hot) : C.ink2, ce * span(t, tl.at(6) + k * 0.25, tl.at(6) + 0.5 + k * 0.25)));
      put(A.L.verify, C.ink, ce * span(t, tl.at(6) + 2.0, tl.at(6) + 2.6));
      items.push({ shape: [contour([480, 380, 480, 660], false)], stroke: C.frame, width: 2, opacity: ce, screen: true });
    }
    // Captions: the words, at the bottom.
    for (const c of tl.cues) {
      const o = window(t, c.start, c.end, 0.3, 0.3);
      if (o > 0) put(text(c.text, { atlas: A.atlas, size: 32, x: 960, y: 1030, anchor: "center" }).shape, C.ink, o);
    }
    return { background: [0.024, 0.024, 0.031], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.2, threshold: 0.9, vignette: 0.25, grain: 0.006 } };
  },
};
