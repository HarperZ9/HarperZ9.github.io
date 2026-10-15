// Night School, lesson L13, "Data: what goes in comes out", as a Motion scene: the same file
// renders the film offline and plays it live. Script and sources: film.json, evidence.json; every
// share and score from facts.json (tools/school/fill_data.mjs). Direction (PROGRESS.md, step 31):
// crates on Pylon's dock, stacked by kind of episode.
import { cues, span, label, plate, C, GUIDES, rect } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";

const FPS = 30;
const POST = { bloom: 0.1, threshold: 1.0, vignette: 0.38, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    mix: { start: at(1), kinds: c.at(1, 0, 1), score: c.at(1, 1, 1), end: at(2) },
    less: { start: at(2), ask: c.ask(2, 0), r40: c.at(2, 1, 0), r20: c.at(2, 1, 1), r05: c.at(2, 1, 2), r0: c.at(2, 2, 0), loss: c.at(2, 2, 1), end: at(3) },
    transfer: { start: at(3), who: c.at(3, 1, 0), copy: c.at(3, 1, 1), end: at(4) },
    noise: { start: at(4), local: c.at(4, 1, 0), look: c.at(4, 1, 1), split: c.at(4, 1, 2), n30: c.at(4, 1, 3), end: at(5) },
    repeat: { start: at(5), ask: c.ask(5, 0), big: c.at(5, 2, 0), fresh: c.at(5, 2, 1), end: at(6) },
    shift: { start: at(6), rerun: c.at(6, 1, 0), others: c.at(6, 1, 1), end: at(7) },
    close: { start: at(7), night: c.at(7, 1, 1), end },
  };
}

const ORDER = [["title", s.title], ["mix", s.mix], ["less", s.less], ["transfer", s.transfer], ["noise", s.noise], ["repeat", s.repeat], ["shift", s.shift], ["close", s.close]];


const scene = {
  title: "Data: what goes in comes out",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.less.ask, T.repeat.ask] };
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
      if (a > 0) items.push({ ...plate(960, 1010, 1300, 76), opacity: 0.75 * a }, label(A, q.text, 40, 960, 1024, C.ink, "center", a));
    }
    return { background: [0.02, 0.016, 0.012], camera: f.camera, items, post: POST };
  },
};
export default scene;
