// Night School, lesson L14, "Scaling: bigger, longer, how much", as a Motion scene: the same file
// renders the film offline and plays it live. Script and sources: film.json, evidence.json; every
// number from facts.json (tools/school/fill_scaling.mjs). Direction (PROGRESS.md, step 31): a shelf
// of small lighthouses, and the frontier on a log-log chart.
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
    shelf: { start: at(1), score: c.at(1, 1, 0), end: at(2) },
    bigger: { start: at(2), small: c.at(2, 0, 0), mid: c.at(2, 0, 1), ask: c.ask(2, 0), big: c.at(2, 1, 1), seeds: c.at(2, 2, 0), end: at(3) },
    compute: { start: at(3), best: c.at(3, 1, 0), line: c.at(3, 1, 1), size: c.at(3, 2, 0), end: at(4) },
    papers: { start: at(4), hoff: c.at(4, 1, 0), ours: c.at(4, 2, 0), end: at(5) },
    close: { start: at(5), night: c.at(5, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["shelf", s.shelfSeg], ["bigger", s.bigger], ["compute", s.compute], ["papers", s.papers], ["close", s.close]];

const scene = {
  title: "Scaling: bigger, longer, how much",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.bigger.ask] };
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
