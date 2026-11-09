// Night School, lesson L15, "Decoding: temperature, top-k, top-p", as a Motion scene: the same file
// renders the film offline and plays it live. Script and sources: film.json, evidence.json; rates
// and runs from facts.json (tools/school/fill_decoding.mjs), the model's shares from lesson L9's
// facts. Direction (PROGRESS.md, step 24): Tallow's brass wheel, spun.
import { cues, span, label, plate, C, GUIDES, LOOKS } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";

const FPS = 30;
const POST = { ...LOOKS.thriller.post, vignette: 0.12, passes: LOOKS.thriller.post.passes.map((p) => (p.pass === "film" ? { ...p, ev: 1.6 } : p.pass === "crt-classic" ? { ...p, vignette: 0.18, curvature: 0.04 } : p)) };
const POST_REDUCED = { ...POST, passes: POST.passes.filter((p) => p.pass !== "crt-classic") };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    greedy: { start: at(1), run: c.at(1, 1, 1), why: c.at(1, 2, 0), end: at(2) },
    sample: { start: at(2), spin: at(2) + 1.5, runs: c.at(2, 1, 0), tally: c.at(2, 1, 1), check: c.at(2, 2, 0), end: at(3) },
    temperature: { start: at(3), cold: c.at(3, 0, 1) + 2, hot: c.at(3, 0, 2), kettle: c.at(3, 1, 0), ask: c.ask(3, 0), rates: c.at(3, 2, 0), rows: [0, 1, 2, 3].map((k) => c.at(3, 2, k)), zero: c.at(3, 3, 0), end: at(4) },
    topk: { start: at(4), k3: c.at(4, 1, 0), end: at(5) },
    topp: { start: at(5), p9: c.at(5, 1, 0), ask: c.ask(5, 0), rate9: c.at(5, 1, 1), p5: c.at(5, 2, 0), few: c.at(5, 2, 1), end: at(6) },
    tail: { start: at(6), small: c.at(6, 1, 1), top: c.at(6, 1, 2), ppl: c.at(6, 2, 0), end: at(7) },
    close: { start: at(7), night: c.at(7, 1, 1), end },
  };
}

const ORDER = [["title", s.title], ["greedy", s.greedy], ["sample", s.sample], ["temperature", s.temperature], ["topk", s.topk], ["topp", s.topp], ["tail", s.tail], ["close", s.close]];

const scene = {
  title: "Decoding: temperature, top-k, top-p",
  duration: 360, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts, NW] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json"), ctx.json("../nextword/facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, NW, rows: c.rows, asks: [T.temperature.ask, T.topp.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = s.openScene(t, A, T.host, A.F);
    else {
      let k = 0;
      for (let i = 0; i < ORDER.length; i++) if (t >= (i === 0 ? 0 : T[ORDER[i - 1][0]].end)) k = i;
      const [name, draw] = ORDER[k];
      f = draw(t, A, T[name], A.F);
    }
    const items = f.items;
    for (const q of A.asks) {
      const a = span(t, q.start - 0.2, q.start + 0.3) * (1 - span(t, q.held + 0.2, q.held + 0.7));
      if (a > 0) items.push({ ...plate(960, 1010, 1500, 76), opacity: 0.75 * a }, label(A, q.text, 36, 960, 1022, C.ink, "center", a));
    }
    return { background: LOOKS.thriller.ground, camera: f.camera, items, post: ctx.reduced ? POST_REDUCED : POST };
  },
};
export default scene;
