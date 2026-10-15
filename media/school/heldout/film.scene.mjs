// Night School, lesson F6, "The held-out set: learning, or remembering?", as a Motion scene: the
// same file renders the film offline and plays it live. Script and sources: film.json,
// evidence.json; every curve and number from facts.json (tools/school/fill_heldout.mjs).
// Direction (PROGRESS.md, step 17): Pylon's printed chart.
import { cues, span, label, plate, C, GUIDES, rect } from "../shared/lib.mjs";
import { desk, pylon } from "../vectors/scene/chart.mjs";
import * as s from "./scene/segs.mjs";

const FPS = 30;
const POST = { bloom: 0.1, threshold: 1.0, vignette: 0.38, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    pts: { start: at(1), line: c.at(1, 1, 1), gentle: c.at(1, 1, 2), wild: c.at(1, 1, 3), ask: c.ask(1, 0), zero: c.at(1, 2, 0), end: at(2) },
    held: { start: at(2), errs: c.at(2, 1, 0), wildErr: c.at(2, 1, 1), flex: c.at(2, 2, 0), turn: c.at(2, 2, 1), end: at(3) },
    leash: { light: c.at(3, 1, 0), hard: c.at(3, 1, 1), end: at(4) },
    spiral: { right: c.at(4, 1, 1), watch: c.at(4, 2, 0), lowest: c.at(4, 2, 1), end: at(5) },
    spread: { start: at(5), best: c.at(5, 1, 0), end: at(6) },
    model: { fresh: at(6), score: c.at(6, 1, 0), unseen: c.at(6, 1, 1), hard: c.at(6, 2, 0), end: at(7) },
    rules: { start: at(7), third: c.at(7, 1, 0), end: at(8) },
    close: { start: at(8), night: c.at(8, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["pts", s.pts], ["held", s.held], ["leash", s.leash], ["spiral", s.spiral], ["spread", s.spread],
  ["model", s.model], ["rules", s.rules], ["close", s.close]];

// Cold open: the lamp comes up on Pylon's desk and the chart.
function open(t) {
  return { items: [...desk(t, 1 - span(t, 0.3, 3)), { shape: rect(330, 110, 1260, 880, 6), fill: [0.9, 0.85, 0.71, span(t, 1, 3)], stroke: "#3a2c1c", width: 4 }, ...pylon(t, 1745, 1015, 0.52), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 1 - span(t, 0, 1.5)] }], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}

const scene = {
  title: "The held-out set: learning, or remembering?",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.pts.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = open(t);
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
