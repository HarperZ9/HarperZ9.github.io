// Night School, lesson L8, "Embeddings: every word gets coordinates", as a Motion scene: the same
// file renders the film offline and plays it live. Script and sources: film.json, evidence.json;
// numbers and every card's place from facts.json (tools/school/fill_embeddings.mjs); the attention
// model's own map from the vectors lesson's facts.json. Direction (PROGRESS.md, step 20): cards
// hanging in Tallow's lamp room, the retro thriller look.
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
    start: { start: at(1), check: c.at(1, 1, 0), end: at(2) },
    idea: { start: at(2), two: c.at(2, 1, 0), nudge: c.at(2, 1, 1), noise: c.at(2, 2, 0), who: c.at(2, 2, 1), end: at(3) },
    train: { run: at(3), ask: c.ask(3, 0), reveal: c.at(3, 1, 0), end2: c.at(3, 1, 1), end: at(4) },
    seeds: { start: at(4), end: at(5) },
    compare: { start: at(5), share: c.at(5, 1, 0), overlap: c.at(5, 1, 1), end: at(6) },
    close: { start: at(6), night: c.at(6, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["start", s.start], ["idea", s.idea], ["train", s.train], ["seeds", s.seeds], ["compare", s.compare], ["close", s.close]];

const scene = {
  title: "Embeddings: every word gets coordinates",
  duration: 230, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts, V] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json"), ctx.json("../vectors/facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, V, rows: c.rows, asks: [T.train.ask] };
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
    return { background: LOOKS.thriller.ground, camera: f.camera, items, post: ctx.reduced ? POST_REDUCED : POST };
  },
};
export default scene;
