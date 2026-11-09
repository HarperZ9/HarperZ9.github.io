// Night School, lesson F5, "Optimisers: momentum, Adam and the step size", as a Motion scene: the
// same file renders the film offline and plays it live. Script and sources: film.json, evidence.json;
// numbers from facts.json (tools/school/fill_optimisers.mjs). The walkers are run at load with the
// lesson's own update rules (system/school/optimisers.mjs) at the steps facts.json chose.
// Direction (PROGRESS.md, step 17): from above, on the contour map.
import { cues, span, label, plate, C, GUIDES } from "../shared/lib.mjs";
import { open as fogOpen } from "../gradients/scene/seg-hill.mjs";
import { ROSENBROCK } from "../../../system/school/gradients.mjs";
import { run2d, RACE_BASE } from "../../../system/school/optimisers.mjs";
import * as s from "./scene/segs.mjs";

const FPS = 30;
const POST = { bloom: 0.3, threshold: 1.0, vignette: 0.32, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    valley: { start: at(1), end: at(2) },
    momentum: { heavy: at(2), polyak: c.at(2, 2, 0), end: at(3) },
    adam: { start: at(3), first: c.at(3, 2, 1), end: at(4) },
    race: { ask: c.ask(4, 0), reveal: c.at(4, 1, 0), bowl: c.at(4, 2, 0), end: at(5) },
    edge: { go: c.at(5, 0, 1), heavy: c.at(5, 1, 1), end: at(6) },
    schedule: { start: at(6), decay: c.at(6, 1, 0), end: at(7) },
    real: { start: at(7), spread: c.at(7, 1, 0), lm: c.at(7, 2, 0), first400: c.at(7, 2, 1), end: at(8) },
    limits: { start: at(8), short: c.at(8, 1, 0), end: at(9) },
    close: { start: at(9), night: c.at(9, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["valley", s.valley], ["momentum", s.momentum], ["adam", s.adam], ["race", s.race], ["edge", s.edge],
  ["schedule", s.schedule], ["real", s.real], ["limits", s.limits], ["close", s.close]];

const scene = {
  title: "Optimisers: momentum, Adam and the step size",
  duration: 330, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film), R = facts.races, ae = facts.aboveEdge, run = (surf, start, n, lr, steps, threshold) => run2d(surf, start, n, { ...RACE_BASE[n], lr }, { steps, threshold });
    const runs = { rosen: {}, bowl: {}, edge: {} };
    for (const n of ["sgd", "momentum", "adam"]) {
      runs.rosen[n] = run(ROSENBROCK, R.rosenbrock.start, n, R.rosenbrock.entrants[n].chosenLr, R.rosenbrock.entrants.adam.stepsToThreshold + 10, R.rosenbrock.threshold);
      runs.bowl[n] = run(s.BOWL, R.bowl.start, n, R.bowl.entrants[n].chosenLr, 200, R.bowl.threshold);
      runs.edge[n] = run(s.BOWL, R.bowl.start, n, ae.lr, 200, R.bowl.threshold);
    }
    // Adam's last move in each direction, per update, for the ellipse.
    const P = runs.rosen.adam.path, adamTrace = P.map((p, i) => [p[0], p[1], i ? Math.abs(p[0] - P[i - 1][0]) : 0, i ? Math.abs(p[1] - P[i - 1][1]) : 0]);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, runs, adamTrace, asks: [T.race.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = fogOpen(t, A, T.host);
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
