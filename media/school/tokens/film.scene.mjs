// Night School, lesson L7, "Tokens: cutting text into crates", as a Motion scene: the same file
// renders the film offline and plays it live. Script and sources: film.json, evidence.json; numbers
// from facts.json (tools/school/fill_tokens.mjs). Crates are cut by the lesson's own encoder: the
// corpus merges from facts.json, and English merges learned at load on the Moby-Dick passage the
// same way fill_tokens.mjs learns them. Direction (PROGRESS.md, step 20): conveyors in the shed.
import { cues, span, label, plate, C, GUIDES } from "../shared/lib.mjs";
import { encodeWord, rankOf, learnBPE, wordCounts, pretokenize } from "../../../system/school/tokens.mjs";
import { MOBY_DICK } from "../../../system/school/tokens-texts.mjs";
import * as s from "./scene/segs.mjs";

const FPS = 30;
const POST = { bloom: 0.3, threshold: 1.0, vignette: 0.32, grain: 0.05, passes: [] };

export function cueMap(c, film) {
  const at = (k) => c.at(k, 0, 0), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS;
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), sub: c.at(0, 0, 1), end: at(1) - 0.3 },
    sizes: { start: at(1), letters: c.at(1, 1, 0), whole: c.at(1, 2, 0), unseen: c.at(1, 2, 1), end: at(2) },
    merge: { start: at(2), count: c.at(2, 0, 2), common: c.at(2, 0, 3), first: c.at(2, 1, 0), ask: c.ask(2, 0), reveal: c.at(2, 2, 0), all: c.at(2, 2, 1), end: at(3) },
    unseen: { start: at(3), cut: c.at(3, 1, 0), who: c.at(3, 1, 2), end: at(4) },
    english: { start: at(4), moby: c.at(4, 0, 1), pride: c.at(4, 1, 0), m400: c.at(4, 1, 1), light: c.at(4, 1, 2), end: at(5) },
    random: { start: at(5), rand: c.at(5, 0, 1), end: at(6) },
    bytes: { start: at(6), quotes: c.at(6, 0, 2), gpt: c.at(6, 1, 0), table: c.at(6, 1, 2), zero: c.at(6, 2, 0), end: at(7) },
    ours: { start: at(7), bpe: c.at(7, 1, 0), end: at(8) },
    close: { start: at(8), night: c.at(8, 1, 0), end },
  };
}

const ORDER = [["title", s.title], ["sizes", s.sizes], ["merge", s.merge], ["unseen", s.unseen], ["english", s.english], ["random", s.random], ["bytes", s.bytes], ["ours", s.ours], ["close", s.close]];

const scene = {
  title: "Tokens: cutting text into crates",
  duration: 280, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    const merges = facts.corpus.allMerges.map(([a, b]) => ({ a, b })), rank = rankOf(merges);
    const eng = learnBPE(wordCounts(pretokenize(MOBY_DICK)), facts.english.totalMerges), erank = rankOf(eng.merges);
    const enc = (w, upto) => encodeWord(w, merges, { upto, rank }), encE = (w, upto) => encodeWord(w, eng.merges, { upto, rank: erank });
    scene.duration = T.host.end;
    scene.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, enc, encE, engMerges: eng.merges, asks: [T.merge.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = s.open(t, A, T.host);
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
    return { background: [0.02, 0.022, 0.03], camera: f.camera, items, post: POST };
  },
};
export default scene;
