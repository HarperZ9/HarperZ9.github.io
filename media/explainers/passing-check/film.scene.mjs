// Film 2, "A passing check can still be wrong", as a Motion scene: one file for the
// video and for the interactive version on explainers.html. The script, the sources,
// the narration and its timing are the film's own files (film.json, evidence.json,
// timing.json); this scene adds no claim. Every cue is a sentence start in timing.json.
// Storyboard: media-excellence STORYBOARDS.md, film 2. Its predict beats wait on a
// script change (they need held silence in the narration), so they are not drawn here.
import { window } from "../../raw-native/web-23ec93f/motion/timeline.mjs";
import { cues } from "../checking-cost/scene/lib.mjs";
import { C, program, veil, tab } from "./scene/world.mjs";
import * as p1 from "./scene/p1-pass.mjs";
import * as p2 from "./scene/p2-coverage.mjs";
import * as p3 from "./scene/p3-mutants.mjs";
import * as p4 from "./scene/p4-patches.mjs";
import * as p5 from "./scene/p5-control.mjs";

const FRAMES = 4317, FPS = 30;

export default {
  title: "A passing check can still be wrong",
  duration: FRAMES / FPS,
  fps: FPS,
  design: [1920, 1080],
  chapters: [],
  // Segment 5's what-if: take the planted failure away and see what a bare pass says.
  params: [{ id: "control", label: "plant a known failure", min: 0, max: 1, step: 1, value: 1, window: [109.9, 129.6], note: "1: the control runs; 0: no control" }],
  async load(ctx) {
    const [sans, head, mono, timing, evidence] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"), ctx.json("timing.json"),
      ctx.json("evidence.json")]);
    const c = cues(timing), A = { sans, head, mono, prog: program() };
    const end = FRAMES / FPS;
    A.T = {
      p1: { enter: c.at(1, 0, 0), tests: c.word(1, 0, 0, "here are its tests"), passes: c.at(1, 0, 1), wrong: c.at(1, 1, 0), never: c.at(1, 1, 1),
        found: c.at(1, 2, 0), could: c.at(1, 2, 1), exit: c.at(2, 0, 0) },
      p2: { enter: c.at(2, 0, 0), study: c.at(2, 1, 0), size: c.at(2, 2, 0), zero: c.at(2, 2, 1), advice: c.at(2, 3, 0), exit: c.at(3, 0, 0) },
      p3: { enter: c.at(3, 0, 0), named: c.at(3, 0, 1), just: c.at(3, 1, 0), coupled: c.at(3, 2, 0), none: c.at(3, 2, 1), exit: c.at(4, 0, 0) },
      p4: { enter: c.at(4, 0, 0), study: c.at(4, 1, 0), shares: c.at(4, 1, 1), earlier: c.at(4, 2, 0), third: c.at(4, 2, 1), preprints: c.at(4, 3, 0),
        far: c.at(4, 3, 1), exit: c.at(5, 0, 0) },
      p5: { enter: c.at(5, 0, 0), passes: c.at(5, 1, 0), control: c.at(5, 1, 1), evidence: c.at(5, 2, 0), absence: c.at(5, 2, 1), close: c.at(6, 0, 0),
        voice: c.at(6, 1, 0), sources: c.at(6, 1, 1), end },
    };
    A.veil = veil();
    A.tabs = [["inozemtseva2014", c.at(2, 1, 0), c.at(3, 0, 0)], ["just2014", c.at(3, 1, 0), c.at(4, 0, 0)],
      ["wang2025", c.at(4, 1, 0), c.at(4, 2, 0)], ["aleithan2024", c.at(4, 2, 0), c.at(5, 0, 0)]].map(([id, t0, t1]) => ({ shape: tab(evidence, id, mono), t0, t1 }));
    p1.prepare(A); p2.prepare(A, ctx); p3.prepare(A); p4.prepare(A); p5.prepare(A);
    this.chapters = [["A passing check can still be wrong", 0], ["Every test passes", c.at(1, 0, 0)], ["Lines run are not faults found", c.at(2, 0, 0)],
      ["Check the check", c.at(3, 0, 0)], ["When AI writes the patch", c.at(4, 0, 0)], ["A check that can show it can fail", c.at(5, 0, 0)],
      ["One thing to keep", c.at(6, 0, 0)]].map(([title, t]) => ({ title, t: Math.max(0, t - 0.4) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T, items = [];
    A.params = ctx.params;
    let camera = { x: 960, y: 545, zoom: 1 };
    if (t < T.p2.enter) camera = p1.camera(t, T.p1, A);
    else if (t < T.p3.enter) camera = p2.camera(t, T.p2);
    else if (t < T.p4.enter) camera = p3.camera(t, T.p3);
    items.push({ shape: A.veil, stroke: C.ink, width: 1, opacity: 0.035, screen: true });
    p1.draw(t, A, T.p1, items);
    p2.draw(t, A, T.p2, items, camera.zoom);
    p3.draw(t, A, T.p3, items);
    p4.draw(t, A, T.p4, items);
    p5.draw(t, A, T.p5, items);
    for (const tb of A.tabs) {
      const a = window(t, tb.t0, tb.t1, 0.6, 0.6);
      if (a > 0) items.push({ shape: tb.shape, fill: C.dim, opacity: a, screen: true });
    }
    return { background: C.void, camera, items, post: { bloom: 0.35, threshold: 0.8, vignette: 0.32, grain: 0.01 } };
  },
};
