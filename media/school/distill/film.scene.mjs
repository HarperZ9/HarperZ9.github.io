// Night School, lesson S17, "Distillation: a big teacher, a small student", as a Motion scene: the
// same file renders the film offline and plays it live. Script and sources: film.json,
// evidence.json; every share and loss from facts.json (tools/school/fill_distill.mjs). Direction
// (PROGRESS.md, step 38): three brass wheels in Tallow's lamp room, the teacher's, the student's and
// the hard label's one slot.
import { cues, span, label, plate, C, GUIDES, LOOKS } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";
import * as b from "./scene/boards.mjs";

const FPS = 30;
const POST = { ...LOOKS.thriller.post, vignette: 0.12, passes: LOOKS.thriller.post.passes.map((p) => (p.pass === "film" ? { ...p, ev: 1.6 } : p.pass === "crt-classic" ? { ...p, vignette: 0.18, curvature: 0.04 } : p)) };
const POST_REDUCED = { ...POST, passes: POST.passes.filter((p) => p.pass !== "crt-classic") };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    labels: { start: at(1), text: c.at(1, 1, 0), soft: c.at(1, 2, 0), torn: c.at(1, 3, 1), end: at(2) },
    temperature: { start: at(2), t2: c.at(2, 1, 1), t4: c.at(2, 1, 1) + 4, student: c.at(2, 2, 0), square: c.at(2, 2, 1), sizes: c.at(2, 3, 0), end: at(3) },
    plenty: { start: at(3), hard: c.at(3, 1, 0), ask: c.ask(3, 0), agree: c.at(3, 2, 1), end: at(4) },
    little: { start: at(4), pool: c.at(4, 1, 0), hard: c.at(4, 2, 1), ask: c.ask(4, 0), mid: c.at(4, 3, 0), caution: c.at(4, 4, 0), end: at(5) },
    wrong: { start: at(5), argmax: c.at(5, 0, 2), copy: c.at(5, 0, 2), counts: c.word(5, 0, 2, "worse than"), untrained: c.at(5, 1, 0), oracle: c.at(5, 2, 0), end: at(6) },
    close: { start: at(6), night: c.at(6, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["labels", s.labels], ["temperature", s.temperature], ["plenty", b.plenty], ["little", b.little], ["wrong", b.wrong], ["close", b.close]];

const scene = {
  title: "Distillation: a big teacher, a small student",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.plenty.ask, T.little.ask] };
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
