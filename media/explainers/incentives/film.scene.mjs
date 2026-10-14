// Film 4, "Models do what training pays for", as a Motion scene: one file for the
// video and for the interactive version on explainers.html. The script, the sources,
// the narration and its timing are the film's own files (film.json, evidence.json,
// timing.json); this scene adds no claim. Every cue is a sentence start in timing.json.
// Storyboard: media-excellence STORYBOARDS.md, film 4. Its predict beat waits on a script
// change (held silence in the narration), so it is not drawn here.
import { window, lerp } from "../../raw-native/web-23ec93f/motion/timeline.mjs";
import { cues } from "../checking-cost/scene/lib.mjs";
import { C } from "./scene/land.mjs";
import * as r1 from "./scene/r1-land.mjs";
import * as r3 from "./scene/r3-episodes.mjs";
import { text } from "../../raw-native/web-23ec93f/motion/text.mjs";

const FRAMES = 3611, FPS = 30;

export default {
  title: "Models do what training pays for",
  duration: FRAMES / FPS,
  fps: FPS,
  design: [1920, 1080],
  chapters: [],
  // Segment 3's what-if: another number of episodes, at the paper's rate of 45 in 32,768.
  params: [{ id: "episodes", label: "episodes (log10)", min: 3, max: 6, step: 0.01, value: Math.log10(32768), window: [60.9, 92.4],
    note: "at 4.52 (32,768) the film shows the paper's 45" }],
  async load(ctx) {
    const [sans, head, mono, timing, evidence] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"), ctx.json("timing.json"),
      ctx.json("evidence.json")]);
    const c = cues(timing), A = { sans, head, mono };
    A.T = {
      s1: { setup: c.at(1, 0, 0), reward: c.at(1, 0, 1), study: c.at(1, 1, 0), raise: c.at(1, 2, 0), neither: c.at(1, 2, 1), measured: c.at(1, 2, 2) },
      s2: { human: c.at(2, 0, 0), assistants: c.at(2, 0, 1), sharma: c.at(2, 1, 0), given: c.at(2, 2, 0), syco: c.at(2, 3, 0) },
      s3: { enter: c.at(3, 0, 0), heldout: c.at(3, 1, 0), did: c.at(3, 2, 0), helpful: c.at(3, 2, 1), small: c.at(3, 3, 0), direction: c.at(3, 3, 1), exit: c.at(4, 0, 0) },
      s4: { none: c.at(4, 0, 0), needs: c.at(4, 0, 1), fix: c.at(4, 1, 0) },
      s5: { close: c.at(5, 0, 0), voice: c.at(5, 1, 0), sources: c.at(5, 1, 1), end: FRAMES / FPS },
    };
    const tab = (id) => {
      const e = evidence.sources[id], hd = e.short.replace(/(\d{4}), /, "$1 . ");
      return text(`${hd} . ${e.n}`, { atlas: mono, size: 28, x: 96, y: 58 }).shape;
    };
    A.tabs = [["baker2025", c.at(1, 1, 0), c.at(2, 0, 0)], ["sharma2024", c.at(2, 1, 0), c.at(3, 0, 0)], ["denison2024", c.at(3, 0, 0), c.at(4, 0, 0)]]
      .map(([id, t0, t1]) => ({ shape: tab(id), t0, t1 }));
    r1.prepare(A); r3.prepare(A, ctx);
    this.chapters = [["Models do what training pays for", 0], ["Paid for passing tests", c.at(1, 0, 0)], ["Paid for agreeing", c.at(2, 0, 0)],
      ["Small rewards, wider habits", c.at(3, 0, 0)], ["Change what gets paid", c.at(4, 0, 0)], ["One thing to keep", c.at(5, 0, 0)]]
      .map(([title, t]) => ({ title, t: Math.max(0, t - 0.4) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T, items = [];
    A.params = ctx.params;
    let camera = r1.camera(t, T), cam3 = { u: 0, zoom: 1 };
    if (t >= T.s3.enter && t < T.s3.exit) {
      cam3 = r3.camera(t, T);
      camera = { x: lerp(960, A.r3.dive[0], cam3.u), y: lerp(540, A.r3.dive[1], cam3.u), zoom: cam3.zoom };
    }
    r1.draw(t, A, T, items);
    r3.draw(t, A, T, items, cam3);
    for (const tb of A.tabs) {
      const a = window(t, tb.t0, tb.t1, 0.6, 0.6);
      if (a > 0) items.push({ shape: tb.shape, fill: C.dim, opacity: a, screen: true });
    }
    return { background: C.void, camera, items, post: { bloom: 0.3, threshold: 0.82, vignette: 0.34, grain: 0.008 } };
  },
};
