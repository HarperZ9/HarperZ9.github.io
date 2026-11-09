// Night School, lesson L10, "Attention: how a language model decides what matters", as a Motion
// scene: the same file renders the film offline and plays it live on the lesson page. The script
// and its sources are film.json and evidence.json; every number about the model comes from
// facts.json, which tools/school/fill_film.mjs computes from model.json (the trained weights).
// Every cue is a sentence start in timing.json, so the pictures re-time when the narration lands.
// Storyboard: Tallow's lamp room (retro thriller look); inside the lens, the model's numbers as
// data art; Rerun at the prism.
import { cues, LOOKS, span, C, label, plate } from "./scene/lib.mjs";
import * as room from "./scene/seg-room.mjs";
import * as ins from "./scene/seg-inside.mjs";
import * as end from "./scene/seg-end.mjs";

const FPS = 30;
// The thriller look (500T print film, then the soft tube), brighter and with a lighter vignette
// than the guides' reel, because this film reads small type and fine threads.
const POST = { ...LOOKS.thriller.post, vignette: 0.12, passes: LOOKS.thriller.post.passes.map((p) => (p.pass === "film" ? { ...p, ev: 1.6 } : p.pass === "crt-classic" ? { ...p, vignette: 0.18, curvature: 0.04 } : p)) };
const POST_REDUCED = { ...POST, passes: POST.passes.filter((p) => p.pass !== "crt-classic") };

// Cue times for each segment, from the timing rows. Segment numbers follow film.json.
export function cueMap(c, film) {
  const open = film.host.open.seconds, close = film.host.close.seconds, s = (k) => c.at(k, 0, 0);
  const T = {
    host: { openEnd: open, end: Math.round((c.last + close) * FPS) / FPS },
    title: { say: s(0), end: s(1) - 0.3 },
    hole: { say0: c.at(1, 1, 0), say1: c.at(1, 1, 1) + 1.2, ask: c.ask(1, 0), reveal: c.at(1, 2, 0), back: c.at(1, 2, 2), end: s(2) },
    whisper: { fixed: c.at(2, 1, 0), line: c.at(2, 2, 0), direct: c.at(2, 3, 0), end: s(3) },
    lamp: { parts: c.at(3, 1, 0), scores: c.at(3, 2, 0), shares: c.at(3, 3, 0), blend: c.at(3, 4, 0), end: s(4) },
    inside: { enter: s(4) - 0.4, dot: c.at(4, 2, 0), sqrt: c.word(4, 3, 0, "square root"), ask: c.ask(4, 0), reveal: c.at(4, 5, 0), end: s(5) },
    heads: { split: c.at(5, 0, 1), eight: c.at(5, 1, 0), ours: c.at(5, 2, 0), end: s(6) },
    sw: { on: c.at(6, 1, 0), offSay: c.at(6, 2, 0), off: c.at(6, 0, 1) + 1.5, uniform: c.at(6, 3, 1), end: s(7) },
    cost: { thousand: c.at(7, 1, 0), double: c.at(7, 1, 1), cannery: c.at(7, 2, 1), end: s(8) },
    edge: { diff: c.at(8, 2, 0), open: c.at(8, 2, 2), end: s(9) },
    close: { drip: c.at(9, 0, 1), iris: c.at(9, 1, 0), end: Math.round((c.last + close) * FPS) / FPS },
  };
  return T;
}

// Which segment draws at time t.
const ORDER = [["title", room.title], ["hole", room.hole], ["whisper", ins.whisper], ["lamp", room.lamp], ["inside", ins.inside],
  ["heads", ins.heads], ["sw", end.switchOff], ["cost", end.cost], ["edge", end.edge], ["close", end.close]];

const scene = {
  title: "Attention: how a language model decides what matters",
  duration: 300, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    const c = cues(timing), T = cueMap(c, film);
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    const asks = [T.hole.ask, T.inside.ask];
    return { sans, head, mono, T, F: facts, asks, film };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = room.open(t, A, T.host);
    else {
      let k = 0;
      for (let i = 0; i < ORDER.length; i++) if (t >= (i === 0 ? 0 : T[ORDER[i - 1][0]].end)) k = i;
      const [name, draw] = ORDER[k];
      f = draw(t, A, T[name], A.F);
    }
    const items = f.items;
    // The two spoken questions sit on screen while asked and through the held pause.
    for (const q of A.asks) {
      const a = span(t, q.start - 0.2, q.start + 0.3) * (1 - span(t, q.held + 0.2, q.held + 0.7));
      if (a > 0) items.push({ ...plate(960, 132, 1100, 76), opacity: 0.7 * a }, label(A, q.text, 40, 960, 146, C.ink, "center", a));
    }
    return { background: LOOKS.thriller.ground, camera: f.camera, items, post: ctx.reduced ? POST_REDUCED : POST };
  },
};
export default scene;
