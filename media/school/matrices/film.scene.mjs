// Night School, lesson F2, "Matrices move space", as a Motion scene: the same file renders the
// film offline and plays it live on the lesson page. Script and sources: film.json, evidence.json;
// every model number comes from facts.json (tools/school/fill_matrices.mjs, from the attention
// lesson's trained weights). Cues are sentence starts in timing.json. Direction (PROGRESS.md, step
// 12): Pylon's printed chart with a tracing sheet the crane moves; the attention question in the
// dark, as data art; the painted harbour's crane for the cold open.
import { cues, LOOKS, span, label, plate, C, GUIDES, QUALITY } from "../shared/lib.mjs";
import { loadHarbour } from "../../raw-native/tree-ada041f/templates/guides/worlds/harbour.mjs";
import * as a from "./scene/seg-a.mjs";
import * as b from "./scene/seg-b.mjs";

const FPS = 30;
const CHART = { bloom: 0.12, threshold: 1.0, vignette: 0.4, grain: 0.06, passes: [] };
const DARK = { bloom: 0.3, threshold: 1.0, vignette: 0.3, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const s = (k) => c.at(k, 0, 0), open = film.host.open.seconds, close = film.host.close.seconds, end = Math.round((c.last + close) * FPS) / FPS;
  return {
    host: { openEnd: open, end },
    title: { say: s(0), sub: c.at(0, 1, 0), end: s(1) - 0.3 },
    crane: { one: s(1), whole: c.at(1, 0, 1), grid: c.at(1, 1, 0), corner: c.at(1, 1, 1), end: s(2) },
    columns: { watch: c.at(2, 0, 1), first: c.at(2, 1, 0), second: c.at(2, 1, 1), all: c.at(2, 2, 0), every: c.at(2, 2, 1), end: s(3) },
    kinds: { turn: s(3), stretch: c.at(3, 1, 0), area: c.at(3, 1, 1), lean: c.at(3, 2, 0), same: c.at(3, 2, 1), end: s(4) },
    order: { ask: c.ask(4, 0), st: c.at(4, 1, 0), ts: c.at(4, 1, 1), prod: c.at(4, 2, 0), end: s(5) },
    corner: { ask: c.ask(5, 0), no: c.at(5, 1, 0), slide: c.at(5, 1, 1), many: c.at(5, 2, 0), end: s(6) },
    question: { back: s(6), layer: c.at(6, 1, 0), meets: c.at(6, 1, 2), out: c.at(6, 2, 0), kettle: c.at(6, 2, 1), mult: c.at(6, 3, 0), div: c.at(6, 3, 1), same: c.at(6, 3, 2), end: s(7) },
    edge: { lines: s(7), ten: c.at(7, 0, 1), bends: c.at(7, 1, 0), soft: c.at(7, 1, 2), end: s(8) },
    close: { start: s(8), next: c.at(8, 1, 0), night: c.at(8, 1, 1), end },
  };
}

const ORDER = [["title", a.title], ["crane", a.crane], ["columns", a.columns], ["kinds", a.kinds], ["order", b.order],
  ["corner", b.corner], ["question", b.question], ["edge", b.edge], ["close", b.close]];

const scene = {
  title: "Matrices move space",
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
    return { sans, head, mono, T, F: facts, W, rows: c.rows, asks: [T.order.ask, T.corner.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = a.open(t, A, T.host);
    else {
      let k = 0;
      for (let i = 0; i < ORDER.length; i++) if (t >= (i === 0 ? 0 : T[ORDER[i - 1][0]].end)) k = i;
      const [name, draw] = ORDER[k];
      f = draw(t, A, T[name], A.F);
    }
    const items = f.items;
    for (const q of A.asks) {
      const al = span(t, q.start - 0.2, q.start + 0.3) * (1 - span(t, q.held + 0.2, q.held + 0.7));
      if (al > 0) items.push({ ...plate(960, 1010, 1300, 76), opacity: 0.75 * al }, label(A, q.text, 40, 960, 1024, C.ink, "center", al));
    }
    // The paint pass is costly; live on a slow device (or reduced motion) the harbour plays unpainted.
    if (f.painted) return { background: LOOKS.painted.ground, camera: f.camera, items, post: ctx.reduced || !QUALITY.paint ? { ...LOOKS.painted.post, passes: [] } : LOOKS.painted.post };
    return { background: [0.02, 0.016, 0.012], camera: f.camera, items, post: f.dark ? DARK : CHART };
  },
};
export default scene;
