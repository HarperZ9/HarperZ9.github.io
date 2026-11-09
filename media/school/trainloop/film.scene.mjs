// Night School, lesson L12, "The training loop", as a Motion scene: the same file renders the film
// offline and plays it live. Script and sources: film.json, evidence.json; every curve and number
// from facts.json (tools/school/fill_trainloop.mjs). Direction (PROGRESS.md, step 28): a track
// round Pylon's dock with four stations and the tally board.
import { cues, span, label, plate, C, GUIDES, rect } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";

const FPS = 30;
const POST = { bloom: 0.1, threshold: 1.0, vignette: 0.38, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    loop: { start: at(1), batch: c.at(1, 0, 1), fwd: c.at(1, 0, 2), back: c.at(1, 1, 0), step: c.at(1, 1, 1), time: c.at(1, 2, 0), end: at(2) },
    settings: { start: at(2), warm: c.at(2, 1, 0), clip: c.at(2, 2, 0), fired: c.at(2, 2, 2), end: at(3) },
    run: { start: at(3), go: c.at(3, 0, 1), m100: c.at(3, 1, 0), ask: c.ask(3, 0), copy: c.at(3, 2, 0), m500: c.at(3, 2, 1), m750: c.at(3, 2, 2), same: c.at(3, 3, 0), end: at(4) },
    change: { start: at(4), noise: c.at(4, 0, 1), low: c.at(4, 1, 0), ask: c.ask(4, 0), high: c.at(4, 1, 1), decay: c.at(4, 2, 0), batch: c.at(4, 3, 0), batch2: c.at(4, 3, 1), end: at(5) },
    broken: { start: at(5), zero: c.at(5, 0, 1), up: c.at(5, 1, 0), end: at(6) },
    close: { start: at(6), night: c.at(6, 1, 1), end },
  };
}

const ORDER = [["title", s.title], ["loop", s.loop], ["settings", s.settings], ["run", s.run], ["change", s.change], ["broken", s.broken], ["close", s.close]];


const scene = {
  title: "The training loop",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.run.ask, T.change.ask] };
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
