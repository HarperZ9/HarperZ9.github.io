// Night School, lesson A27, "Dynamic programming: remember what you already worked out", as a Motion
// scene: the same file renders the film offline and plays it live. Script and sources: film.json,
// evidence.json; every value from facts.json (tools/school/fill_editdistance.mjs). Direction
// (PROGRESS.md, step 73): the tide table filled square by square, and the naive call tree fanning out.
import { cues, span, label, plate, C, GUIDES, LOOKS } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";
import * as l from "./scene/later.mjs";

const FPS = 30;
const POST = { ...LOOKS.thriller.post, vignette: 0.12, passes: LOOKS.thriller.post.passes.map((p) => (p.pass === "film" ? { ...p, ev: 1.6 } : p.pass === "crt-classic" ? { ...p, vignette: 0.18, curvature: 0.04 } : p)) };
const POST_REDUCED = { ...POST, passes: POST.passes.filter((p) => p.pass !== "crt-classic") };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS, ask = c.ask(2, 0);
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), end: at(1) - 0.3 },
    problem: { start: at(1), edits: c.at(1, 1, 0), end: at(2) },
    naive: { start: at(2), ask, kitten: c.at(2, 1, 1), intention: c.at(2, 1, 2), end: at(3) },
    explode: { start: Math.max(at(3), ask.held), cells: c.at(3, 1, 0), end: at(4) },
    table: { start: at(4), fill: c.at(4, 1, 0), corner: c.at(4, 1, 2), end: at(5) },
    trace: { start: at(5), back: c.at(5, 0, 1), pair: c.at(5, 1, 0), end: at(6) },
    greedy: { start: at(6), wrong: c.at(6, 1, 0), end: at(7) },
    bellman: { start: at(7), today: c.at(7, 0, 1), uses: c.at(7, 1, 0), end: at(8) },
    close: { start: at(8), night: c.at(8, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["problem", s.problem], ["naive", s.naive], ["explode", l.explode], ["table", l.table], ["trace", l.trace], ["greedy", l.greedy], ["bellman", l.bellman], ["close", l.close]];

const scene = {
  title: "Dynamic programming",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.naive.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = s.open(t, A, T.host, A.F);
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
