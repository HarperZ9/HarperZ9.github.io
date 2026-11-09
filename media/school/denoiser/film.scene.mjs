// Night School, lesson K25, "Case study: the denoiser's tensor-core parity", as a Motion scene: the same
// file renders the film offline and plays it live. Script and sources: film.json, evidence.json; every
// value from facts.json (tools/school/fill_denoiser.mjs). Direction (PROGRESS.md, step 72): Rerun's tide
// line, a patch of image with one glint, the bound as a fixed slot on a gauge, the fixes as stones
// thrown at a post that does not move.
import { cues, span, label, plate, C, GUIDES, LOOKS } from "../shared/lib.mjs";
import * as s from "./scene/segs.mjs";
import * as l from "./scene/later.mjs";

const FPS = 30;
const POST = { ...LOOKS.thriller.post, vignette: 0.12, passes: LOOKS.thriller.post.passes.map((p) => (p.pass === "film" ? { ...p, ev: 1.6 } : p.pass === "crt-classic" ? { ...p, vignette: 0.18, curvature: 0.04 } : p)) };
const POST_REDUCED = { ...POST, passes: POST.passes.filter((p) => p.pass !== "crt-classic") };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS, ask = c.ask(1, 0);
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), end: at(1) - 0.3 },
    parity: { start: at(1), rule: c.at(1, 1, 1), read: c.at(1, 2, 0), ask, coop: Math.max(c.at(1, 2, 1), ask.held), end: at(2) },
    rare: { start: at(2), p99: c.at(2, 0, 1), worst: c.at(2, 1, 1), end: at(3) },
    reproduce: { start: at(3), emu: c.at(3, 1, 0), split: c.at(3, 2, 2), end: at(4) },
    glint: { start: at(4), divide: c.at(4, 1, 0), filter: c.at(4, 1, 1), end: at(5) },
    arithmetic: { start: at(5), marks: c.at(5, 0, 2), stand: c.at(5, 2, 1), noGlint: c.at(5, 2, 2), end: at(6) },
    fixes: { start: at(6), head: c.at(6, 1, 0), three: c.at(6, 1, 1), six: c.at(6, 1, 2), fp32: c.at(6, 2, 0), end: at(7) },
    bound: { start: at(7), options: c.at(7, 0, 1), kept: c.at(7, 1, 0), end: at(8) },
    close: { start: at(8), night: c.at(8, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["parity", s.parity], ["rare", s.rare], ["reproduce", s.reproduce], ["glint", s.glint], ["arithmetic", l.arithmetic], ["fixes", l.fixes], ["bound", l.bound], ["close", l.close]];

const scene = {
  title: "The denoiser's tensor-core parity",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.parity.ask] };
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
