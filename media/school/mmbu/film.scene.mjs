// Night School, lesson S20, "Case study: our MMBU Challenge entry", as a Motion scene: the same file
// renders the film offline and plays it live. Script and sources: film.json, evidence.json; every value
// from facts.json (tools/school/fill_mmbu.mjs). Direction (PROGRESS.md, step 83): Tallow's logbook, each
// run a ruled line with its bar pencilled in before the interval is inked; the two answer keys for the
// vocabulary beat; burn lines for the survival beat; the ledger as a grid of entries.
import { cues, span, label, plate, C, GUIDES, LOOKS, rect } from "../shared/lib.mjs";
import { room, scene, page, ink, logbook, shares, keys, burn, ledger, PAGE, EMBER } from "./scene/book.mjs";

const FPS = 30;
// A calmer look than the other films' thriller grade: the logbook is a bright paper page, and the
// thriller's film exposure and bloom wash it into glare (contact sheet r1, PROGRESS.md step 84).
const POST = { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] };
const POST_REDUCED = POST;

export function cueMap(c, film) {
  const at = (s, l = 0, k = 0) => c.at(s, l, k), end = Math.round((c.last + film.host.close.seconds) * FPS) / FPS, ask = c.ask(2, 0);
  return {
    host: { openEnd: film.host.open.seconds, end },
    title: { say: at(0), end: at(1) - 0.3 },
    challenge: { start: at(1), q: at(1, 0, 1), models: at(1, 1, 0), work: at(1, 1, 1), end: at(2) },
    bar: { start: at(2), pencil: c.word(2, 0, 0, "the bar it had to clear"), ft4: at(2, 1, 0), ask, end: at(3) },
    miss: { start: at(3), ink4: Math.max(at(3), ask.held), rule: at(3, 0, 1), ft5: at(3, 1, 0), ink5: c.word(3, 1, 0, "up "), end: at(4) },
    prior: { start: at(4), champ: at(4, 0, 1), guess: at(4, 0, 2), cheat: at(4, 0, 3), blank: at(4, 1, 1), off: at(4, 1, 3), end: at(5) },
    knows: { start: at(5), fav: at(5, 0, 1), book: at(5, 1, 1), ink6: c.word(5, 1, 1, "the sixth run beat"), end: at(6) },
    rule: { start: at(6), champ: at(6, 0, 1), turned: at(6, 0, 2), signed: at(6, 1, 1), ink7: at(6, 1, 2), end: at(7) },
    words: { start: at(7), fall: at(7, 0, 1), flip: at(7, 1, 1), neutral: at(7, 1, 2), end: at(8) },
    lights: { start: at(8), idle: c.word(8, 0, 2, "Code that had never run"), dup: c.word(8, 0, 2, "two trainers"), fix: c.word(8, 0, 2, "now, when"), end: at(9) },
    ledger: { start: at(9), pushed: at(9, 0, 1), local: at(9, 1, 0), hour: at(9, 1, 2), end: at(10) },
    close: { start: at(10), ft8: at(10, 0, 1), lab: at(10, 1, 0), night: at(10, 1, 1), end },
  };
}

// The logbook's rows across the film; which are drawn, and how far, depends on the segment.
function rows(F, t, T, upto) {
  const R = [[`fourth run: ${F.records.ft4.newSources} new sources`, F.ft4.H1, 0, T.bar.ft4, T.bar.pencil, T.miss.ink4], ["fifth run: a second pass", F.ft5.K1, 0, T.miss.ft5, T.miss.ft5, T.miss.ink5],
    ["sixth run: region questions", F.ft6.M2, 0, T.knows.book, T.knows.book, T.knows.ink6], ["seventh run: size-adjusted score", F.ft7.N4, 0, T.rule.ink7 - 1.5, T.rule.ink7 - 1.5, T.rule.ink7 + 1]];
  return R.slice(0, upto).map(([name, r, bar, show, pencil, inked]) => ({ name, r, bar, show: span(t, show, show + 0.8), pencil: span(t, pencil, pencil + 0.8), inked: span(t, inked, inked + 1.4) }));
}
const S = {
  open: (t, A, T) => ({ items: [...room(t), ...page(span(t, 1, 3.5))], camera: { x: 960, y: 540, zoom: 1.04 - 0.04 * span(t, 0, 4) } }),
  title: (t, A, T) => { const a = Math.min(span(t, T.title.say, T.title.say + 0.6), 1 - span(t, T.title.end - 0.8, T.title.end));
    return scene(t, A, [...room(t), ...page(), label(A, "Our MMBU Challenge entry", 72, PAGE.x + PAGE.w / 2, 470, "#1d1812", "center", a, "head"), ink(A, "case study", 28, PAGE.x + PAGE.w / 2, 540, a, "#5d564b", "center")]); },
  challenge: (t, A, T, F) => { const R = F.records, x = 620, L = (s, y, at, size = 24) => ink(A, s, size, x, y, span(t, at, at + 0.8));
    return scene(t, A, [...room(t), ...page(), ink(A, "the contest", 26, x, 175),
      L(`MMBU, from ${R.challenge.organiser}: ${R.challenge.datasets} public datasets`, 260, T.challenge.start + 0.3),
      L("one answer per question about an image; no tools, no second tries", 330, T.challenge.q),
      L("scored on the answer, and on context", 390, T.challenge.q + 2.5),
      L(`two Qwen 3.5 models: ${(R.models.params2b / 1e9).toFixed(1)} and ${(R.models.params4b / 1e9).toFixed(1)} billion numbers`, 480, T.challenge.models),
      L(`small LoRA strips, rank ${R.models.rank}; ${R.challenge.sources} sources, all listed`, 540, T.challenge.models + 3),
      L("benchmark work, not a medical tool", 640, T.challenge.work, 22), L("every score: our own scorers, not the contest's judge", 690, T.challenge.work + 2, 22)]); },
  bar: (t, A, T, F) => scene(t, A, [...room(t), ...logbook(t, A, rows(F, t, T, 1))]),
  miss: (t, A, T, F) => scene(t, A, [...room(t), ...logbook(t, A, rows(F, t, T, 2))]),
  prior: (t, A, T, F) => { const P = T.prior, B = F.baselines, items = [...room(t), ...page(), ink(A, "share of practice answers right", 24, 610, 175)];
    items.push(...shares(t, A, [{ name: "the champion (third run)", v: F.ft7.T.FT3A_4B, at: P.champ, hot: true }, { name: "a guesser who sees the options", v: B.chance, at: P.guess }, { name: "the most common answer per kind", v: B.oracle, at: P.cheat }], { y0: 230 }));
    items.push(...shares(t, A, [{ name: "fourth run, real pictures", v: F.audit.real, at: P.blank }, { name: "fourth run, blank pictures", v: F.audit.blank, at: P.blank + 1.5, hot: true }], { y0: 560 }));
    items.push(ink(A, `${Math.round(F.prior.offTaxonomy * 100)} percent of answers named none of the options`, 22, 610, 820, span(t, P.off, P.off + 0.8), "#a8502e"));
    return scene(t, A, items); },
  knows: (t, A, T, F) => { const K = T.knows, O = F.option;
    if (t >= K.book - 0.5) return scene(t, A, [...room(t), ...logbook(t, A, rows(F, t, T, 3))]);
    return scene(t, A, [...room(t), ...page(), ink(A, `the fifth run, on ${O.rows.toLocaleString("en")} questions with one right label (for our eyes only)`, 22, 610, 175),
      ...shares(t, A, [{ name: "its favourite option", v: O.R1, at: K.fav }, { name: "its written answer", v: O.G, at: K.fav + 2.5, hot: true }], { y0: 300, max: 0.6 }),
      ink(A, `gap ${ (O.diff.mean * 100).toFixed(1)} points, interval ${(O.diff.lo * 100).toFixed(1)} to ${(O.diff.hi * 100).toFixed(1)}`, 22, 610, 560, span(t, K.fav + 4, K.fav + 5))]); },
  rule: (t, A, T, F) => { const R = T.rule;
    if (t >= R.ink7 - 1.6) return scene(t, A, [...room(t), ...logbook(t, A, rows(F, t, T, 4))]);
    const X = (v) => 700 + ((v - 0.99) / 0.01) * 1000, items = [...room(t), ...page(), ink(A, "share of valid context replies", 24, 610, 175)];
    items.push({ shape: rect(700, 420, 1000, 3), fill: [0.6, 0.55, 0.45, 1], screen: true }, { shape: rect(X(0.999) - 2, 330, 4, 120), fill: [0.45, 0.42, 0.37, 1], screen: true }, ink(A, "the bar: 99.9", 20, X(0.999), 320, 1, "#5d564b", "center"));
    [0.99, 0.995, 1].forEach((v) => items.push(ink(A, `${(v * 100).toFixed(1)}`, 18, X(v), 470, 1, "#5d564b", "center")));
    const dot = (v, name, at, y, anchor) => { const a = span(t, at, at + 0.8); items.push({ shape: rect(X(v) - 7, 413, 14, 17, 3), fill: [...EMBER, a], screen: true }, ink(A, `${name}: ${(v * 100).toFixed(2)}`, 22, X(v) + (anchor === "right" ? -14 : 0), y, a, "#a8502e", anchor)); };
    dot(F.ft6.pass2, "sixth run", R.start + 1, 390, "right"); dot(F.ft7.candidate.pass2, "the champion", R.champ, 520, "center");
    items.push(ink(A, "as written, the bar turns away its own champion", 22, 610, 640, span(t, R.turned, R.turned + 0.8)));
    items.push(ink(A, `new rule for later runs, signed with the seventh run at step ${F.records.amend2.step}: every answer bar met, format no worse`, 20, 610, 720, span(t, R.signed, R.signed + 0.8)));
    return scene(t, A, items); },
  words: (t, A, T, F) => scene(t, A, [...room(t), ...keys(t, A, F, T.words)]),
  lights: (t, A, T, F) => scene(t, A, [...room(t), ...burn(t, A, F, T.lights)]),
  ledger: (t, A, T, F) => scene(t, A, [...room(t), ...ledger(t, A, F, T.ledger)]),
  close: (t, A, T, F) => { const K = T.close, Sv = F.records.survival, dim = span(t, K.night, K.end);
    const items = [...room(t), ...page(1 - 0.6 * dim), ink(A, "the logbook, as it stands", 24, 610, 175, 1 - dim),
      ink(A, "candidate: the seventh run; nothing submitted", 24, 610, 300, span(t, K.start, K.start + 0.8) * (1 - dim)),
      ink(A, `eighth run: stopped at step ${Sv.ft8Step} of ${Sv.ft8Steps.toLocaleString("en")}, paused by the author`, 24, 610, 370, span(t, K.ft8, K.ft8 + 0.8) * (1 - dim)),
      { shape: rect(610 + 1100 * (Sv.ft8Step / Sv.ft8Steps), 420, 4, 60), fill: [0.45, 0.42, 0.37, span(t, K.ft8, K.ft8 + 0.8) * (1 - dim)], screen: true },
      { shape: rect(610, 448, 1100 * (Sv.ft8Step / Sv.ft8Steps), 6, 3), fill: [0.16, 0.14, 0.12, span(t, K.ft8, K.ft8 + 0.8) * (1 - dim)], screen: true },
      ink(A, `the contest runs to ${F.records.challenge.deadline}`, 24, 610, 560, span(t, K.ft8 + 6, K.ft8 + 7) * (1 - dim))];
    return scene(t, A, items); },
};
const ORDER = ["title", "challenge", "bar", "miss", "prior", "knows", "rule", "words", "lights", "ledger", "close"];

const scene_ = {
  title: "Our MMBU Challenge entry",
  duration: 440, fps: FPS, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, timing, film, facts] = await Promise.all([
      ctx.json("../../explainers/motion/hanken-500.json"), ctx.json("../../explainers/motion/hanken-650.json"), ctx.json("../../explainers/motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("film.json"), ctx.json("facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const c = cues(timing), T = cueMap(c, film);
    scene_.duration = T.host.end;
    scene_.chapters = film.segments.map((sg, i) => ({ title: sg.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return { sans, head, mono, T, F: facts, rows: c.rows, asks: [T.bar.ask] };
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    let f;
    if (t < T.host.openEnd) f = S.open(t, A, T);
    else {
      let k = 0;
      for (let i = 0; i < ORDER.length; i++) if (t >= (i === 0 ? 0 : T[ORDER[i - 1]].end)) k = i;
      f = S[ORDER[k]](t, A, T, A.F);
    }
    const items = f.items;
    for (const q of A.asks) {
      const a = span(t, q.start - 0.2, q.start + 0.3) * (1 - span(t, q.held + 0.2, q.held + 0.7));
      if (a > 0) items.push({ ...plate(960, 1010, 1500, 76), opacity: 0.75 * a }, label(A, q.text, 36, 960, 1022, C.ink, "center", a));
    }
    return { background: LOOKS.thriller.ground, camera: f.camera, items, post: ctx.reduced ? POST_REDUCED : POST };
  },
};
export default scene_;
