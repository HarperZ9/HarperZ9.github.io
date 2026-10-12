// Film 5, "What a model's written reasoning can and cannot show", as a Motion scene: one
// file for the video and for the interactive version on explainers.html. The script, the
// sources, the narration and its timing are the film's own files (film.json, evidence.json,
// timing.json); this scene adds no claim. Every cue is a sentence start in timing.json.
// Storyboard: media-excellence STORYBOARDS.md, film 5. Its predict beat waits on a script
// change (held silence in the narration), so it is not drawn here.
import { text } from "../../raw-native/web-23ec93f/motion/text.mjs";
import { window } from "../../raw-native/web-23ec93f/motion/timeline.mjs";
import { cues } from "../checking-cost/scene/lib.mjs";
import { C } from "./scene/ribbon.mjs";
import * as v1 from "./scene/v1-hint.mjs";
import * as v2 from "./scene/v2-monitors.mjs";

const FRAMES = 3280, FPS = 30;

export default {
  title: "What a model's written reasoning can and cannot show",
  duration: FRAMES / FPS,
  fps: FPS,
  design: [1920, 1080],
  chapters: [],
  // Segment 3's switch: which monitor reads, and whether the penalty has been applied.
  params: [{ id: "monitor", label: "monitor reads", min: 0, max: 3, step: 1, value: 3, window: [60.4, 83.1],
    note: "0 actions; 1 actions and reasoning; 2 after the penalty; 3 follows the film" }],
  async load(ctx) {
    const [sans, head, mono, timing, evidence] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"), ctx.json("timing.json"),
      ctx.json("evidence.json")]);
    const c = cues(timing), A = { sans, head, mono };
    A.T = {
      s1: { ask: c.at(1, 0, 0), hintAt: c.word(1, 0, 0, "I think"), turpin: c.at(1, 1, 0), argued: c.at(1, 1, 1), fell: c.at(1, 2, 0), read: c.at(1, 3, 0), cause: c.at(1, 3, 1) },
      s2: { enter: c.at(2, 0, 0), study: c.at(2, 0, 1), kinds: c.at(2, 1, 0), shortcut: c.at(2, 2, 0) },
      s3: { enter: c.at(3, 0, 0), actions: c.at(3, 0, 1), both: c.at(3, 1, 0), penalty: c.at(3, 2, 0), continued: c.at(3, 2, 1) },
      s4: { enter: c.at(4, 0, 0), readout: c.at(4, 1, 0), check: c.at(4, 1, 1) },
      s5: { close: c.at(5, 0, 0), voice: c.at(5, 1, 0), sources: c.at(5, 1, 1), end: FRAMES / FPS },
    };
    const tab = (id) => {
      const e = evidence.sources[id], hd = e.short.replace(/(\d{4}), /, "$1 . ");
      return text(`${hd} . ${e.n}`, { atlas: mono, size: 28, x: 96, y: 58 }).shape;
    };
    A.tabs = [["turpin2023", c.at(1, 1, 0), c.at(2, 0, 0)], ["chen2025", c.at(2, 0, 1), c.at(3, 0, 0)], ["baker2025", c.at(3, 0, 1), c.at(4, 0, 0)],
      ["korbak2025", c.at(4, 0, 0), c.at(5, 0, 0)]].map(([id, t0, t1]) => ({ shape: tab(id), t0, t1 }));
    v1.prepare(A); v2.prepare(A);
    this.chapters = [["What written reasoning can and cannot show", 0], ["A hint it does not mention", c.at(1, 0, 0)], ["How often the hint is named", c.at(2, 0, 0)],
      ["Still worth reading", c.at(3, 0, 0)], ["Useful, and fragile", c.at(4, 0, 0)], ["One thing to keep", c.at(5, 0, 0)]]
      .map(([title, t]) => ({ title, t: Math.max(0, t - 0.4) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T, items = [];
    A.params = ctx.params;
    v1.draw(t, A, T, items);
    v2.draw(t, A, T, items);
    for (const tb of A.tabs) {
      const a = window(t, tb.t0, tb.t1, 0.6, 0.6);
      if (a > 0) items.push({ shape: tb.shape, fill: C.dim, opacity: a, screen: true });
    }
    return { background: C.void, camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.32, threshold: 0.8, vignette: 0.3, grain: 0.008 } };
  },
};
