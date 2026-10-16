// Night School, lesson S19, "LoRA and fine-tuning", as a Motion scene: the same file renders the
// film offline and plays it live. Script and sources: film.json, evidence.json; every value from
// facts.json (tools/school/fill_lora.mjs). Direction (PROGRESS.md, step 38): the second floor's query,
// key and value table as a hull of planks in Tallow's lamp room, and the two thin strips whose product
// is the change.
import { cues, span, label, plate, C, GUIDES, LOOKS } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";
import * as c2 from "./scene/charts.mjs";

const FPS = 30;
const POST = { ...LOOKS.thriller.post, vignette: 0.12, passes: LOOKS.thriller.post.passes.map((p) => (p.pass === "film" ? { ...p, ev: 1.6 } : p.pass === "crt-classic" ? { ...p, vignette: 0.18, curvature: 0.04 } : p)) };
const POST_REDUCED = { ...POST, passes: POST.passes.filter((p) => p.pass !== "crt-classic") };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    job: { start: at(1), base: c.at(1, 1, 1), yard: c.at(1, 2, 0), end: at(2) },
    full: { start: at(2), learn: c.at(2, 1, 0), before: c.at(2, 2, 1), after: c.at(2, 2, 2), end: at(3) },
    rudder: { start: at(3), strips: c.at(3, 0, 1), multiply: c.at(3, 0, 2), count: c.at(3, 1, 0), pair: c.at(3, 1, 1), zero: c.at(3, 2, 0), end: at(4) },
    howmany: { start: at(4), ask: c.ask(4, 0), all: c.at(4, 1, 0), odd: c.at(4, 2, 0), seeds: c.at(4, 3, 0), end: at(5) },
    shape: { start: at(5), top: c.at(5, 1, 0), random: c.at(5, 1, 2), cut: c.at(5, 2, 2), end: at(6) },
    forget: { start: at(6), rows: c.at(6, 1, 0), end: at(7) },
    close: { start: at(7), night: c.at(7, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["job", s.job], ["full", s.full], ["rudder", s.rudder], ["howmany", c2.howmany], ["shape", c2.shape], ["forget", c2.forget], ["close", c2.close]];

const scene = {
  title: "LoRA and fine-tuning",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.howmany.ask] };
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
