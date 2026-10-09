// Film 1, "Claiming got cheap. Checking did not.", as a Motion scene: one file
// for the video and for the interactive version on explainers.html. The script,
// the sources, the narration and its timing are the film's own files
// (film.json, evidence.json, timing.json); this scene adds no claim. Every cue
// below is a sentence start in timing.json, so the pictures move with the voice.
import { rect, circle } from "../../raw-native/web-23ec93f/motion/path.mjs";
import { morph } from "../../raw-native/web-23ec93f/motion/morph.mjs";
import { span, window, ease } from "../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, cues } from "./scene/lib.mjs";
import * as s1 from "./scene/s1-reference.mjs";
import * as s2 from "./scene/s2-list.mjs";
import * as s3 from "./scene/s3-year.mjs";
import * as s4 from "./scene/s4-spread.mjs";
import * as s5 from "./scene/s5-rerun.mjs";
import * as s6 from "./scene/s6-close.mjs";

const FRAMES = 5324, FPS = 30;

export default {
  title: "Claiming got cheap. Checking did not.",
  duration: FRAMES / FPS,
  fps: FPS,
  design: [1920, 1080],
  layers: { threads: { world: 5, particles: 1 << 18, exposure: 0.9, persistence: 0.86, scale: 0.5, warm: 240 } },
  chapters: [],
  // A what-if for segment 3: the hours one review takes. At 6 the film shows the paper's own figures;
  // any other value recomputes the total from the paper's count of reviews and says it is yours.
  params: [{ id: "hours", label: "hours per review", min: 2, max: 12, step: 0.5, value: 6, window: [58.5, 85], note: "the paper uses about 6" }],
  async load(ctx) {
    const [sans, head, mono, timing] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"), ctx.json("timing.json")]);
    const c = cues(timing);
    const A = { sans, head, mono };
    const pull = c.end(1, 3, 0) + 0.15;
    A.T = {
      s1: { morph: 3.85, parts: c.at(1, 0, 0), word: c.word, frame: c.at(1, 1, 0), invented: c.at(1, 1, 1), copies: c.at(1, 2, 0),
        page: c.word(1, 2, 0, "nothing on the page"), look: c.at(1, 3, 0), pull, cardGone: pull + 4.8 },
      s2: { enter: pull, cardGone: pull + 4.8, search: c.word(2, 0, 0, "searched"), fab3: c.at(2, 1, 0), fab4: c.at(2, 1, 1), wrong: c.at(2, 2, 0),
        same: c.at(2, 3, 0), apart: c.at(2, 3, 1), exit: c.at(3, 0, 0) + 1.0 },
      s3: { enter: c.at(3, 0, 0) - 0.2, review: c.at(3, 0, 1), count: c.at(3, 1, 0), six: c.at(3, 1, 1), years: c.word(3, 1, 1, "about fifteen"),
        caveat: c.at(3, 2, 0), exit: c.at(4, 0, 0) },
      s4: { enter: c.at(4, 0, 0), cascades: c.at(4, 0, 1), race: c.at(4, 1, 0), bots: c.at(4, 2, 0), spread: c.at(4, 3, 0), adage: c.at(4, 3, 1),
        never: c.at(4, 3, 2), exit: c.at(5, 0, 0) },
      s5: { enter: c.at(5, 0, 0) - 0.3, rerun: c.at(5, 1, 0), papers: c.at(5, 1, 1), quick: c.at(5, 2, 0), help: c.at(5, 2, 1), missed: c.at(5, 3, 0),
        none: c.at(5, 3, 1), exit: c.at(6, 0, 0) + 0.4 },
      s6: { enter: c.at(6, 0, 0), one: c.at(6, 0, 1), two: c.at(6, 1, 0), voice: c.at(6, 2, 0), sources: c.at(6, 2, 1), end: FRAMES / FPS },
    };
    // A card becomes a dot as the camera pulls back (segments 1 and 2 share the rule).
    const card = rect(-s1.CARD.w / 2, -s1.CARD.h / 2, s1.CARD.w, s1.CARD.h, 0.5), dot = circle(0, 0, s2.R, 36);
    const m = morph(card, dot, { density: 0.3 });
    A.cardToDotU = (zoom) => 1 - span(Math.log(zoom), Math.log(1.7), Math.log(7), ease.linear);
    A.cardToDot = (u, x, y) => s2.translateShape(m(u), x, y);
    s2.prepare(A); s1.prepare(A, c); s3.prepare(A); s4.prepare(A, ctx); s5.prepare(A); s6.prepare(A);
    this.chapters = [["Claiming got cheap", 0], ["One reference", c.at(1, 0, 0)], ["One study's worth of references", c.at(2, 0, 0)],
      ["A year of checking", c.at(3, 0, 0)], ["Faster than the check", c.at(4, 0, 0)], ["Where the gap can close", c.at(5, 0, 0)],
      ["Two things to keep", c.at(6, 0, 0)]].map(([title, t]) => ({ title, t: Math.max(0, t - 0.4) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T, items = [];
    A.params = ctx.params;
    const world = { x: 960, y: 545, zoom: 1 };
    let camera;
    if (t < T.s1.pull + 4.6) camera = s1.camera(t, A, T.s1, ctx.reduced);
    else if (t < T.s3.enter) camera = world;
    else if (t < T.s3.exit) camera = s3.camera(t, A, T.s3, ctx.reduced, world);
    else camera = { x: 960, y: 540, zoom: 1 };
    const threads = Math.max(0.6 * window(t, 0, T.s1.morph + 1.2, 0.01, 1.4), 0.4 * window(t, T.s6.enter - 0.5, T.s6.end + 1, 2.0, 0.01));
    if (threads > 0) items.push({ kind: "threads", opacity: threads });
    if (t < T.s2.exit + 0.1) s2.draw(t, A, T.s2, items, camera.zoom);
    s1.draw(t, A, T.s1, items, camera.zoom);
    if (t >= T.s3.enter && t < T.s3.exit) s3.draw(t, A, T.s3, items, camera.zoom);
    if (t >= T.s4.enter) s4.draw(t, A, T.s4, items);
    s5.draw(t, A, T.s5, items);
    s6.draw(t, A, T.s6, items);
    return { background: C.void, camera, items, post: { bloom: 0.4, threshold: 0.82, vignette: 0.3, grain: 0.008 } };
  },
};
