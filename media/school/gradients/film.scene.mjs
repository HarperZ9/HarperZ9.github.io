// Night School, lesson F3, "Gradients: which way is downhill", as a Motion scene: the same file
// renders the film offline and plays it live on the lesson page. Script and sources: film.json,
// evidence.json; numbers from facts.json (tools/school/fill_gradients.mjs); descent paths on the
// toy surfaces are computed here by the same code. Cues are sentence starts in timing.json.
// Direction (PROGRESS.md, step 14): the hill in fog, a contour map that lifts into a line relief.
import { cues, span, label, plate, C, GUIDES } from "../shared/lib.mjs";
import * as h from "./scene/seg-hill.mjs";
import * as m from "./scene/seg-model.mjs";

const FPS = 30;
const POST = { bloom: 0.3, threshold: 1.0, vignette: 0.32, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const s = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: s(0), sub: c.at(0, 0, 1), end: s(1) - 0.3 },
    slope: { east: s(1), north: c.at(1, 1, 0), list: c.at(1, 1, 1), up: c.at(1, 2, 0), down: c.at(1, 2, 1), feel: c.at(1, 2, 2), cauchy: c.at(1, 2, 4), end: s(2) },
    step: { bowl: s(2), ask: c.ask(2, 0), reveal: c.at(2, 2, 0), edge: c.at(2, 2, 1), half: c.at(2, 3, 0), under: c.at(2, 3, 1), over: c.at(2, 3, 2), twice: c.at(2, 3, 3), end: s(3) },
    valley: { creep: s(3) + 2, ratio: c.at(3, 0, 1), end: s(4) },
    valleys: { starts: c.at(4, 0, 1), ask: c.ask(4, 0), reveal: c.at(4, 1, 0), lower: c.at(4, 1, 1), end: s(5) },
    real: { start: s(5), before: c.at(5, 1, 0), after: c.at(5, 1, 1), slice: c.at(5, 2, 0), values: c.at(5, 2, 1), warn: c.at(5, 3, 0), end: s(6) },
    one: { start: s(6), bottom: c.at(6, 1, 0), small: c.at(6, 2, 1), big: c.at(6, 2, 2), end: s(7) },
    edge: { start: s(7), handful: c.at(7, 0, 1), chain: c.at(7, 1, 0), end: s(8) },
    close: { start: s(8), night: c.at(8, 1, 0), end },
  };
}

const ORDER = [["title", h.title], ["slope", h.slope], ["step", h.step], ["valley", h.valley], ["valleys", h.valleys],
  ["real", m.real], ["one", m.one], ["edge", m.edge], ["close", m.close]];

const scene = {
  title: "Gradients: which way is downhill",
  duration: 330, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.step.ask, T.valleys.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = h.open(t, A, T.host);
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
    return { background: [0.02, 0.025, 0.035], camera: f.camera, items, post: POST };
  },
};
export default scene;
