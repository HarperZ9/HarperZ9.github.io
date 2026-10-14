// Film 6, "Provenance and the commons", as a Motion scene: one file for the video and for the
// interactive version. The script, the sources and the timing are the film's own files
// (film.json, evidence.json, timing.json); this scene adds no claim. Every cue is a sentence
// start (or a word inside one) in timing.json, so the pictures re-time when the narration lands.
// Draft: timing.json is provisional (written from the script at the author's measured pace) and
// the two predict beats are silent stills pending the author's script decision.
//
// One world: a net of fine threads seen from above (storyboard). Pylon hosts it from her painted
// harbour at the cold open and the close (scene/host.mjs). Each chapter is a knot the camera
// dives into, opened as a lens.
import { C, cues, tab, net, netShapes, drawNet, provenance, fly, words, scrim, span, window, ease, lerp } from "./scene/world.mjs";
import * as host from "./scene/host.mjs";
import * as s1 from "./scene/s1-xz.mjs";
import * as s2 from "./scene/s2-lesson.mjs";
import * as s3 from "./scene/s3-lasting.mjs";
import * as s4 from "./scene/s4-lost.mjs";
import * as s5 from "./scene/s5-close.mjs";

const FPS = 30;
const FIELD = { x: 960, y: 540, zoom: 0.5 }, DIVE = 9;
const at = (k, zoom) => ({ x: k.x, y: k.y, zoom });

const scene = {
  title: "Provenance and the commons",
  duration: 240,   // set from the timing in load()
  fps: FPS,
  design: [1920, 1080],
  chapters: [],
  params: [],
  async load(ctx) {
    const [sans, head, mono, timing, evidence, film] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"), ctx.json("timing.json"),
      ctx.json("evidence.json"), ctx.json("film.json")]);
    const c = cues(timing), A = { sans, head, mono, H: await host.load(ctx) };
    const open = film.host.open.seconds, close = film.host.close.seconds;
    const end = Math.round((c.last + close) * FPS) / FPS;
    scene.duration = end;
    A.N = net(); A.NS = netShapes(A.N);
    const K = A.N.named;
    // Cue times. Words are found in the sentence text, so they follow the narration.
    const T = {
      host: { openEnd: open, closeStart: c.last + 0.4, end },
      title: { gather: open, say: c.at(0, 0, 0), pull: c.at(0, 1, 0) },
      s1: { dive: c.at(1, 0, 0) - 0.4, xz: c.word(1, 0, 0, "xz"), hobby: c.at(1, 1, 0), newc: c.at(1, 2, 0), months: c.at(1, 2, 1),
        release: c.at(1, 3, 0), signed: c.word(1, 3, 0, "signed"), only: c.at(1, 4, 0), slow: c.at(1, 5, 0), slowWord: c.word(1, 5, 0, "half a second"),
        exit: c.end(1, 5, 0) + 0.8, ask: c.ask(1, 0) },
      s2: { freedom: c.word(2, 0, 0, "freedom"), misread: c.at(2, 1, 0), ruler: c.word(2, 1, 0, "outside ruler"), mutual: c.at(2, 2, 0), exit: c.end(2, 2, 0) + 0.6 },
      s3: { enter: c.at(3, 0, 0) - 0.6, eight: c.word(3, 1, 0, "eight"), rules: c.at(3, 2, 0), watch: c.at(3, 3, 0), review: c.at(3, 4, 0),
        twoThirds: c.word(3, 4, 0, "two thirds"), groups: c.at(3, 5, 0), exit: c.end(3, 5, 0) + 0.2 },
      s4: { zoom: c.at(4, 0, 0), gh: c.word(4, 1, 0, "72"), loose: c.at(4, 2, 0), trace: c.at(4, 3, 0), c4: c.at(4, 4, 0) - 0.4,
        c4word: c.word(4, 4, 0, "about 5"), exit: c.end(4, 4, 0) + 0.6, ask: c.ask(4, 0) },
      s5: { where: c.word(5, 0, 0, "where"), when: c.word(5, 0, 0, "when"), how: c.word(5, 0, 0, "how a"), check: c.at(5, 1, 0), exit: c.end(5, 1, 0) + 0.5 },
      s6: { one: c.at(6, 0, 0), two: c.at(6, 1, 0), three: c.at(6, 2, 0), exit: c.at(7, 0, 0) - 0.2 },
      s7: { enter: c.at(7, 0, 0), one: c.at(7, 0, 1), two: c.at(7, 1, 0), voice: c.at(7, 2, 0), end: c.last + 0.3 },
    };
    // Lens openings follow the camera's arrival at each knot.
    T.s1.open = T.s1.dive + 2.6;
    T.s2.fly = T.s1.exit + 0.3; T.s2.open = T.s2.fly + 2.8;
    T.s3.fly = T.s2.exit + 0.3;
    T.s4.fly = Math.min(T.s3.exit, T.s4.ask.start - 3.0); T.s4.open = T.s4.fly + 2.2;
    T.s5.fly = T.s4.exit + 0.3; T.s5.open = T.s5.fly + 2.8;
    A.T = T;
    // The camera's keys: [time, framing]; between keys it flies (log zoom, smooth position).
    const mid = (a, b, z) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: z });
    A.keys = [
      [0, at(K.centre, 1.3)], [T.title.pull, at(K.centre, 1.3)], [T.title.pull + 5, FIELD], [T.s1.dive, FIELD], [T.s1.dive + 3, at(K.xz, DIVE)],
      [T.s2.fly, at(K.xz, DIVE)], [T.s2.fly + 1.4, mid(K.xz, K.pasture, 1.1)], [T.s2.fly + 3.0, at(K.pasture, DIVE)],
      [T.s3.fly, at(K.pasture, DIVE)], [T.s3.fly + 1.4, mid(K.pasture, K.lasting, 1.2)], [T.s3.fly + 3.0, { x: 700, y: 268, zoom: 3.6 }],
      [T.s4.fly, { x: 700, y: 268, zoom: 3.6 }], [T.s4.fly + 1.2, mid(K.lasting, K.datasets, 1.2)], [T.s4.fly + 2.6, at(K.datasets, DIVE)],
      [T.s5.fly, at(K.datasets, DIVE)], [T.s5.fly + 1.4, mid(K.datasets, K.xz, 1.1)], [T.s5.fly + 3.0, at(K.xz, DIVE)],
      [T.s5.exit, at(K.xz, DIVE)], [T.s5.exit + 3.2, { x: 960, y: 560, zoom: 0.8 }], [T.s7.enter, { x: 960, y: 560, zoom: 0.8 }],
      [T.s7.enter + 7, { x: 960, y: 540, zoom: 0.42 }],
    ];
    // Source tabs, each over the lines that use its source.
    const tb = (id, t0, t1) => ({ shape: tab(evidence, id, mono), t0, t1 });
    A.tabs = [tb("collin2022", c.at(1, 1, 0), c.at(1, 2, 0)), tb("cox-timeline", c.at(1, 2, 0), c.at(1, 2, 1)), tb("collin2022b", c.at(1, 2, 1), c.at(1, 3, 0)),
      tb("tukaani", c.at(1, 3, 0), c.at(1, 4, 0)), tb("freund2024", c.at(1, 4, 0), T.s1.exit), tb("hardin1968", c.at(2, 0, 0), T.s2.exit),
      tb("ostrom2010", c.at(3, 0, 0), T.s3.exit), tb("longpre2023", T.s4.ask.start, c.at(4, 4, 0)), tb("longpre2024", c.at(4, 4, 0), T.s4.exit),
      tb("slsa12", c.at(5, 0, 0), T.s5.exit), tb("ostrom2010", c.at(6, 0, 0), c.at(6, 1, 0)), tb("longpre2023", c.at(6, 1, 0), c.at(6, 2, 0)),
      tb("freund2024", c.at(6, 2, 0), T.s6.exit)];
    // The two predict questions (approved 2026-10-14): on screen while asked and through the hold.
    A.asks = [T.s1.ask, T.s4.ask].map((q) => { const sh = words(q.text, sans, 36, 960, 140, "center").shape; return { ...q, shape: sh, scrim: scrim(sh, 16) }; });
    A.titleShape = words("Provenance and the commons", head, 72, 960, 520, "center").shape;
    A.titleScrim = scrim(A.titleShape, 30);
    s1.prepare(A); s2.prepare(A); s3.prepare(A); s4.prepare(A); s5.prepare(A);
    scene.chapters = film.segments.map((s, i) => ({ title: s.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    // The host beats are painted frames of their own (her home style).
    const painted = host.frame(t, ctx, A.H, T.host);
    if (painted) return painted;
    const items = [];
    const camera = cameraAt(A.keys, t);
    // The net gathers from the dark after the cold open, outward from the centre knot.
    const gather = span(t, T.title.gather, T.title.gather + 3.2, ease.out);
    const fade = 1 - 0.55 * window(t, T.s6.one - 1, T.s6.exit + 0.5, 1.0, 1.0);
    const out = 1 - span(t, T.host.closeStart - 0.6, T.host.closeStart, ease.inOut);
    drawNet(A.NS, items, fade * out, gather, { zoom: camera.zoom });
    // The named knots' own provenance threads: xz's is cut from the moment the tarball-only file
    // shows until the record of segment 5 re-ties it; the rest stay intact.
    for (const [name, k] of Object.entries(A.N.named)) {
      const state = name !== "xz" ? "intact" : t >= T.s1.only + 1.0 && t < T.s5.how + 0.8 ? "cut" : t >= T.s5.how + 0.8 ? "traced" : "intact";
      provenance(items, k, state, fade * out * span(t, T.title.gather + 1, T.title.gather + 3), camera.zoom);
    }
    // Title, on the narration's first words.
    const ti = window(t, T.title.say, T.title.pull + 1.5, 0.8, 1.0);
    if (ti > 0) { items.push({ ...A.titleScrim, opacity: 0.7 * ti }); items.push({ shape: A.titleShape, fill: C.ink, opacity: ti, screen: true }); }
    s1.draw(t, A, T.s1, items);
    s2.draw(t, A, { ...T.s2, open: T.s2.open, exit: T.s2.exit }, items);
    s3.draw(t, A, T.s3, items, camera);
    s4.draw(t, A, T.s4, items);
    s5.draw(t, A, T.s5, T.s6, T.s7, items);
    // The predict questions sit over everything else while they are asked and held.
    for (const q of A.asks) {
      const a = window(t, q.start, q.held + 0.4, 0.4, 0.6);
      if (a > 0) { items.push({ ...q.scrim, opacity: 0.7 * a }); items.push({ shape: q.shape, fill: C.ink, opacity: a, screen: true }); }
    }
    for (const tb of A.tabs) {
      const a = window(t, tb.t0, tb.t1, 0.6, 0.6);
      if (a > 0) items.push({ shape: tb.shape, fill: C.dim, opacity: a, screen: true });
    }
    return { background: C.void, camera, items, post: { bloom: 0.35, threshold: 0.8, vignette: 0.3, grain: 0.008 } };
  },
};

function cameraAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i], [t0, a] = keys[i - 1];
    if (t < t1) return t1 - t0 < 1e-6 ? b : fly(t, a, b, t0, t1);
  }
  return keys[keys.length - 1][1];
}

export default scene;
