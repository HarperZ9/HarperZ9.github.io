// Night School, lesson F4, "Backpropagation: blame, passed backwards", as a Motion scene: the same
// file renders the film offline and plays it live on the lesson page. Script and sources: film.json,
// evidence.json; every number from facts.json (tools/school/fill_backprop.mjs), including the real
// trace of one held-out point through the trained network. Cues are sentence starts in timing.json.
// Direction (PROGRESS.md, step 15): the network as a bucket chain stepped down the hill.
import { cues, span, label, plate, C, GUIDES } from "../shared/lib.mjs";
import * as g from "./scene/segs.mjs";

const FPS = 30;
const POST = { bloom: 0.28, threshold: 1.0, vignette: 0.32, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const s = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: s(0), sub: c.at(0, 0, 1), end: s(1) - 0.3 },
    network: { map: c.at(1, 0, 1), numbers: c.at(1, 1, 0), forward: c.at(1, 2, 0), fwdName: c.at(1, 2, 2), end: s(2) },
    nudge: { start: s(2), slow: c.at(2, 1, 0), every: c.at(2, 1, 1), attn: c.at(2, 1, 2), end: s(3) },
    back: { ask: c.ask(3, 0), last: c.at(3, 1, 0), hands: c.at(3, 1, 1), each: c.at(3, 1, 2), rule: c.at(3, 2, 0), who: c.at(3, 2, 1), end: s(4) },
    cost: { count: c.at(4, 1, 0), not: c.at(4, 1, 1), end: s(5) },
    check: { after: c.at(5, 1, 0), breakIt: c.at(5, 2, 0), where: c.at(5, 2, 1), end: s(6) },
    learn: { start: s(6), acc: c.at(6, 1, 0), end: s(7) },
    big: { start: s(7), checked: c.at(7, 1, 0), full: c.at(7, 1, 1), end: s(8) },
    close: { start: s(8), night: c.at(8, 1, 0), end },
  };
}

const ORDER = [["title", g.title], ["network", g.network], ["nudge", g.nudge], ["back", g.back], ["cost", g.cost],
  ["check", g.check], ["learn", g.learn], ["big", g.big], ["close", g.close]];

const scene = {
  title: "Backpropagation: blame, passed backwards",
  duration: 300, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts, grad] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json"), ctx.json("../gradients/facts.json")]);
    for (const gd of Object.values(GUIDES)) if (gd.textures && ctx.motion) for (const [k, v] of Object.entries(gd.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, attnParams: grad.gradientNorm.nParams, asks: [T.back.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = g.open(t, A, T.host);
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
