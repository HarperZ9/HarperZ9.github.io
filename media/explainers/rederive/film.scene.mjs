// Film 3, "Re-derive it. Don't take it on trust.", as a Motion scene: one file for the
// video and for the interactive version on explainers.html. The script, the sources, the
// narration and its timing are the film's own files (film.json, evidence.json,
// timing.json); this scene adds no claim. Every cue is a sentence start in timing.json.
// Storyboard: media-excellence STORYBOARDS.md, film 3, the one film on the paper pole:
// the finish runs without bloom, which would wash a light ground. Its predict beat waits
// on a script change (held silence in the narration), so it is not drawn here.
import { text } from "../../raw-native/web-23ec93f/motion/text.mjs";
import { window } from "../../raw-native/web-23ec93f/motion/timeline.mjs";
import { cues } from "../checking-cost/scene/lib.mjs";
import { C } from "./scene/print.mjs";
import * as d1 from "./scene/d1-repeat.mjs";
import * as d2 from "./scene/d2-records.mjs";

const FRAMES = 3736, FPS = 30;

export default {
  title: "Re-derive it. Don't take it on trust.",
  duration: FRAMES / FPS,
  fps: FPS,
  design: [1920, 1080],
  chapters: [],
  params: [],
  async load(ctx) {
    const [sans, head, mono, timing, evidence] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"), ctx.json("timing.json"),
      ctx.json("evidence.json")]);
    const c = cues(timing), A = { sans, head, mono };
    A.T = {
      s1: { enter: c.at(1, 0, 0), stats: c.at(1, 0, 1), either: c.at(1, 1, 0), cheap: c.at(1, 2, 0), slow: c.at(1, 2, 1) },
      s2: { enter: c.at(2, 0, 0), ninety7: c.at(2, 1, 0), came: c.at(2, 1, 1), half: c.at(2, 2, 0), wrong: c.at(2, 3, 0), miss: c.at(2, 3, 1) },
      s3: { enter: c.at(3, 0, 0), stodden: c.at(3, 1, 0), got: c.at(3, 2, 0), rule: c.at(3, 3, 0) },
      s4: { enter: c.at(4, 0, 0), checks: c.at(4, 1, 0), y2012: c.at(4, 2, 0), y2017: c.at(4, 2, 1), caused: c.at(4, 3, 0), stranger: c.at(4, 3, 1) },
      s5: { close: c.at(5, 0, 0), ask: c.at(5, 0, 1), voice: c.at(5, 1, 0), sources: c.at(5, 1, 1), end: FRAMES / FPS },
    };
    const tab = (id) => {
      const e = evidence.sources[id], hd = e.short.replace(/(\d{4}), /, "$1 . ");
      return text(`${hd} . ${e.n}`, { atlas: mono, size: 28, x: 96, y: 1058 }).shape;
    };
    A.tabs = [["osc2015", c.at(2, 0, 0), c.at(3, 0, 0)], ["stodden2018", c.at(3, 1, 0), c.at(4, 0, 0)], ["kumar2018", c.at(4, 1, 0), c.at(5, 0, 0)]]
      .map(([id, t0, t1]) => ({ shape: tab(id), t0, t1 }));
    d1.prepare(A); d2.prepare(A, ctx);
    this.chapters = [["Re-derive it", 0], ["A result on the page", c.at(1, 0, 0)], ["A hundred studies, run again", c.at(2, 0, 0)],
      ["Asking for the data", c.at(3, 0, 0)], ["A check that anyone can run", c.at(4, 0, 0)], ["One thing to keep", c.at(5, 0, 0)]]
      .map(([title, t]) => ({ title, t: Math.max(0, t - 0.4) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T, items = [];
    let camera = { x: 960, y: 540, zoom: 1 };
    if (t >= T.s4.enter && t < T.s5.close) camera = d2.camera(t, T, A);
    d1.draw(t, A, T, items);
    d2.draw(t, A, T, items, camera.zoom);
    for (const tb of A.tabs) {
      const a = window(t, tb.t0, tb.t1, 0.6, 0.6);
      if (a > 0) items.push({ shape: tb.shape, fill: C.ink2, opacity: a, screen: true });
    }
    return { background: C.ground, camera, items, post: { bloom: 0, threshold: 1, vignette: 0.18, grain: 0.012 } };
  },
};
