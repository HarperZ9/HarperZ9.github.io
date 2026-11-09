// Night School, lesson F1, "Vectors: a list of numbers is a place", as a Motion scene: the same
// file renders the film offline and plays it live on the lesson page. Script and sources are
// film.json and evidence.json; every number about the model comes from facts.json, which
// tools/school/fill_vectors.mjs computes from the attention lesson's trained weights. Every cue is
// a sentence start in timing.json, so the pictures re-time when the narration lands. Direction
// (PROGRESS.md, step 11): Pylon's printed chart from above for the geometry, the attention film's
// columns of dots for 32 directions, the painted harbour for the cold open.
import { cues, LOOKS, span, label, plate, C, GUIDES, QUALITY } from "../shared/lib.mjs";
import { loadHarbour } from "../../raw-native/tree-ada041f/templates/guides/worlds/harbour.mjs";
import * as ch from "./scene/seg-chart.mjs";
import * as sp from "./scene/seg-space.mjs";

const FPS = 30;
const CHART = { bloom: 0.12, threshold: 1.0, vignette: 0.4, grain: 0.06, passes: [] };
const DARK = { bloom: 0.3, threshold: 1.0, vignette: 0.3, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const s = (k) => c.at(k, 0, 0), open = film.host.open.seconds, close = film.host.close.seconds, end = Math.round((c.last + close) * FPS) / FPS;
  return {
    host: { openEnd: open, end },
    title: { say: s(0), sub: c.at(0, 0, 1), end: s(1) - 0.3 },
    place: { here: s(1), walk: c.at(1, 0, 1), list: c.at(1, 1, 0), vector: c.at(1, 1, 1), arrow: c.at(1, 2, 0), same: c.at(1, 2, 1), end: s(2) },
    arrows: { add: s(2), walk: c.at(2, 0, 1), sum: c.at(2, 0, 2), stretch: c.at(2, 1, 0), two: c.at(2, 1, 1), neg: c.at(2, 1, 2), end: s(3) },
    dot: { products: c.at(3, 0, 1), swing: c.at(3, 1, 0), ask: c.ask(3, 0), reveal: c.at(3, 2, 0), named: c.at(3, 2, 2), tour: c.at(3, 2, 3), end: s(4) },
    cos: { push: c.at(4, 0, 1), ask: c.ask(4, 0), reveal: c.at(4, 1, 0), divide: c.at(4, 2, 0), angle: c.at(4, 2, 1), dial: c.at(4, 2, 2),
      wSame: c.word(4, 2, 2, "one when"), wZero: c.word(4, 2, 2, "zero at"), wOpp: c.word(4, 2, 2, "minus one"), never: c.at(4, 2, 3), end: s(5) },
    many: { long: c.at(5, 0, 1), ours: c.at(5, 1, 0), place: c.at(5, 1, 1), picture: c.at(5, 2, 0), still: c.at(5, 2, 2), end: s(6) },
    words: { moved: c.at(6, 0, 1), close: c.at(6, 1, 0), tallow: c.at(6, 1, 2), share: c.at(6, 2, 0), shuffle: c.at(6, 2, 1), before: c.at(6, 2, 2), big: c.at(6, 3, 0), king: c.at(6, 3, 1), end: s(7) },
    cone: { start: s(7), cargo: c.at(7, 1, 0), nb: c.at(7, 1, 2), phrase: c.at(7, 2, 0), job: c.at(7, 2, 1), means: c.at(7, 3, 0), end: s(8) },
    flat: { start: s(8), squash: c.at(8, 1, 0), keep: c.at(8, 1, 1), only: c.at(8, 2, 0), all: c.at(8, 2, 1), end: s(9) },
    close: { start: s(9), next: c.at(9, 1, 0), night: c.at(9, 1, 2), end },
  };
}

const ORDER = [["title", ch.title], ["place", ch.place], ["arrows", ch.arrows], ["dot", ch.dotSeg], ["cos", ch.cosSeg],
  ["many", sp.many], ["words", sp.wordsSeg], ["cone", sp.coneSeg], ["flat", sp.flatSeg], ["close", sp.close]];

const scene = {
  title: "Vectors: a list of numbers is a place",
  duration: 330, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    const W = { ...(await loadHarbour()), atlas: sans };
    return { sans, head, mono, T, F: facts, W, rows: c.rows, asks: [T.dot.ask, T.cos.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = ch.open(t, A, T.host);
    else {
      let k = 0;
      for (let i = 0; i < ORDER.length; i++) if (t >= (i === 0 ? 0 : T[ORDER[i - 1][0]].end)) k = i;
      const [name, draw] = ORDER[k];
      f = draw(t, A, T[name], A.F);
    }
    const items = f.items;
    // The spoken questions sit on screen while asked and through the held pause.
    for (const q of A.asks) {
      const a = span(t, q.start - 0.2, q.start + 0.3) * (1 - span(t, q.held + 0.2, q.held + 0.7));
      if (a > 0) items.push({ ...plate(960, 1010, 1300, 76), opacity: 0.75 * a }, label(A, q.text, 40, 960, 1024, C.ink, "center", a));
    }
    // The paint pass is costly; live on a slow device (or reduced motion) the harbour plays unpainted.
    if (f.painted) return { background: LOOKS.painted.ground, camera: f.camera, items, post: ctx.reduced || !QUALITY.paint ? { ...LOOKS.painted.post, passes: [] } : LOOKS.painted.post };
    return { background: [0.02, 0.016, 0.012], camera: f.camera, items, post: f.dark ? DARK : CHART };
  },
};
export default scene;
