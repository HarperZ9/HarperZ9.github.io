// Night School, lesson K21, "Threads, workgroups and memory", as a Motion scene: the same file renders
// the film offline and plays it live. Script and sources: film.json, evidence.json; every count from
// facts.json (tools/school/fill_threads.mjs). Direction (PROGRESS.md, step 53): Pylon's cannery, crews
// coloured by workgroup, trips to the warehouse drawn as lines.
import { cues, span, label, plate, C, GUIDES, LOOKS } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";
import * as l from "./scene/later.mjs";

const FPS = 30;
const POST = { ...LOOKS.thriller.post, vignette: 0.12, passes: LOOKS.thriller.post.passes.map((p) => (p.pass === "film" ? { ...p, ev: 1.6 } : p.pass === "crt-classic" ? { ...p, vignette: 0.18, curvature: 0.04 } : p)) };
const POST_REDUCED = { ...POST, passes: POST.passes.filter((p) => p.pass !== "crt-classic") };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), end: at(1) - 0.3 },
    threads: { start: at(1), thread: c.at(1, 1, 1), end: at(2) },
    crews: { start: at(2), forty: c.at(2, 1, 1), whole: c.at(2, 2, 0), idle: c.at(2, 2, 1), end: at(3) },
    edge: { start: at(3), ask: c.ask(3, 0), forty: c.at(3, 0, 1), checks: c.at(3, 2, 0), end: at(4) },
    warehouse: { start: at(4), near: c.at(4, 1, 0), spread: c.at(4, 2, 0), end: at(5) },
    count: { start: at(5), ask: c.ask(5, 0), near: c.at(5, 0, 1), far: c.at(5, 0, 2), ratio: c.at(5, 0, 3), end: at(6) },
    measure: { start: at(6), lab: c.at(6, 1, 0), end: at(7) },
    close: { start: at(7), night: c.at(7, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["threads", s.threads], ["crews", s.crews], ["edge", s.edge], ["warehouse", l.warehouse], ["count", l.count], ["measure", l.measure], ["close", l.close]];

const scene = {
  title: "Threads, workgroups and memory",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.edge.ask, T.count.ask] };
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
